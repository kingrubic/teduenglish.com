import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { canOpen, fail, focusGuardOn, quizBySlug, requireAdmin, saveAttempt, studentFromToken } from "./lib";

/*
 * Guarded tests (IELTS Reading/Writing by default): leaving the page for another tab or app warns once
 * with a 5-second countdown; staying away longer, or leaving a second time, submits what the student
 * has done and locks the account until a teacher unlocks it. The server enforces the deadline, so
 * closing the tab doesn't escape it.
 */

export const WARN_SECONDS = 5;
const GRACE_MS = 1500; // network delay on the way back
const LIMIT_MS = WARN_SECONDS * 1000 + GRACE_MS;

const answersArg = v.record(v.string(), v.union(v.string(), v.number()));

/** "away" events for this test since the student last submitted it (a reload doesn't reset the count). */
export async function awayCount(ctx: QueryCtx, studentId: Id<"students">, quiz: Doc<"quizzes">) {
  const last = (await ctx.db.query("attempts").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect())
    .filter((a) => a.quizId === quiz._id)
    .reduce((m, a) => Math.max(m, a.submittedAt), 0);
  return (
    await ctx.db
      .query("focusEvents")
      .withIndex("by_student_quiz", (q) => q.eq("studentId", studentId).eq("quizId", quiz._id).gt("at", last))
      .collect()
  ).length;
}

async function lockStudent(ctx: MutationCtx, student: Doc<"students">, quiz: Doc<"quizzes">, answers: Record<string, string | number>, durationSec?: number) {
  if (!student.active) return;
  await saveAttempt(ctx, quiz, student._id, answers, { durationSec, leftQuiz: true });
  await ctx.db.patch(student._id, { active: false, lockedReason: `Rời bài “${quiz.title}” khi đang làm`, lockedAt: Date.now() });
  for (const s of await ctx.db.query("studentSessions").withIndex("by_student", (q) => q.eq("studentId", student._id)).collect()) await ctx.db.delete(s._id);
}

async function guardedTest(ctx: MutationCtx, token: string, id: string) {
  const student = await studentFromToken(ctx, token);
  const quiz = await quizBySlug(ctx, id);
  if (!student || !quiz || !quiz.published || !canOpen(student, quiz.folder) || !focusGuardOn(quiz)) return null;
  return { student, quiz };
}

/**
 * The student left the test page. First time: a warning with a deadline; second time: locked.
 * `awayMs`: how long ago they left, measured by the page (phones pause pages in the background,
 * so this call can arrive late).
 */
export const away = mutation({
  args: { token: v.string(), id: v.string(), answers: answersArg, durationSec: v.optional(v.number()), awayMs: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ status: "off" } | { status: "warned"; eventId: Id<"focusEvents">; seconds: number } | { status: "locked" }> => {
    const t = await guardedTest(ctx, args.token, args.id);
    if (!t) return { status: "off" };
    const before = await awayCount(ctx, t.student._id, t.quiz);
    const ago = Math.max(0, Math.min(args.awayMs ?? 0, 10 * 60_000));
    const now = Date.now() - ago;
    const lock = before >= 1 || ago > LIMIT_MS;
    const eventId = await ctx.db.insert("focusEvents", {
      studentId: t.student._id,
      quizId: t.quiz._id,
      at: now,
      ...(args.durationSec != null ? { durationSec: args.durationSec } : {}),
      ...(lock ? { locked: true } : { answers: args.answers }),
    });
    if (lock) {
      await lockStudent(ctx, t.student, t.quiz, args.answers, args.durationSec);
      return { status: "locked" };
    }
    await ctx.scheduler.runAfter(LIMIT_MS - ago, internal.guard.deadline, { eventId });
    return { status: "warned", eventId, seconds: WARN_SECONDS };
  },
});

/** The student came back; too late means locked. */
export const back = mutation({
  args: { token: v.string(), eventId: v.id("focusEvents"), awayMs: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ status: "ok" | "locked" }> => {
    const ev = await ctx.db.get(args.eventId);
    const student = await studentFromToken(ctx, args.token);
    if (!ev || !student || ev.studentId !== student._id) return { status: "locked" };
    if (ev.locked) return { status: "locked" };
    const now = Date.now();
    if (now - ev.at > LIMIT_MS || (args.awayMs ?? 0) > LIMIT_MS) {
      const quiz = await ctx.db.get(ev.quizId);
      await ctx.db.patch(ev._id, { locked: true, backAt: now, answers: undefined });
      if (quiz) await lockStudent(ctx, student, quiz, ev.answers ?? {}, ev.durationSec);
      return { status: "locked" };
    }
    // The snapshot was only needed in case of a lock.
    if (!ev.backAt) await ctx.db.patch(ev._id, { backAt: now, answers: undefined });
    return { status: "ok" };
  },
});

/** Runs when the countdown ends: still away (or the tab was closed) → lock. */
export const deadline = internalMutation({
  args: { eventId: v.id("focusEvents") },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.backAt || ev.locked) return;
    const student = await ctx.db.get(ev.studentId);
    const quiz = await ctx.db.get(ev.quizId);
    await ctx.db.patch(ev._id, { locked: true, answers: undefined });
    if (student && quiz) await lockStudent(ctx, student, quiz, ev.answers ?? {}, ev.durationSec);
  },
});

/** Teacher unlocks a student who was locked out. */
export const unlock = mutation({
  args: { token: v.string(), id: v.id("students") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const s = await ctx.db.get(args.id);
    if (!s) fail("Không tìm thấy học sinh.");
    await ctx.db.patch(s._id, { active: true, lockedReason: undefined, lockedAt: undefined });
  },
});
