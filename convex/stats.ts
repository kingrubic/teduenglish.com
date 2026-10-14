import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { allFolders, canOpen, fail, requireAdmin } from "./lib";
import { bandFor, hasEssay, lastTwoWords, normCode, percent, writingTestBand, type IeltsSkill } from "./model";

type Ctx = QueryCtx | MutationCtx;

/* ======================= IELTS bands ======================= */

/** Listening/Reading from the quiz setting; Writing for tests with essays in the IELTS folder (or marked so). */
export function skillOf(q: Doc<"quizzes">): IeltsSkill | null {
  if (q.ielts) return q.ielts;
  return q.folder === "ielts" && hasEssay(q.sections) ? "writing" : null;
}

/** Band of one attempt; Writing needs every task marked with a band. */
export function attemptBand(q: Doc<"quizzes">, a: Doc<"attempts">, skill: IeltsSkill): number | null {
  if (skill !== "writing") return a.band ?? bandFor(skill, a.correct, a.total);
  const tasks: (number | undefined)[] = [];
  q.sections.forEach((sec, si) =>
    sec.questions.forEach((qq, qi) => {
      if (qq.type === "essay") tasks.push(a.essayReviews?.[`${si}-${qi}`]?.band);
    }),
  );
  return writingTestBand(tasks);
}

export type IeltsTest = { id: string; title: string; skill: IeltsSkill; folder: string };

/** Best band per student per IELTS test. */
export async function ieltsBoard(ctx: Ctx) {
  const quizzes = (await ctx.db.query("quizzes").collect()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const tests: IeltsTest[] = [];
  const scores: Record<string, Record<string, number>> = {};
  for (const q of quizzes) {
    const skill = skillOf(q);
    if (!skill) continue;
    tests.push({ id: q.slug, title: q.title, skill, folder: q.folder });
    for (const a of await ctx.db.query("attempts").withIndex("by_quiz", (x) => x.eq("quizId", q._id)).collect()) {
      const band = attemptBand(q, a, skill);
      if (band == null) continue;
      const row = (scores[a.studentId] ??= {});
      row[q.slug] = Math.max(row[q.slug] ?? 0, band);
    }
  }
  return { tests, scores };
}

/* ======================= completion (chuyên cần) ======================= */

export type Progress = {
  total: number;
  done: number;
  rate: number;
  byFolder: { id: string; name: string; total: number; done: number; rate: number }[];
  pending: { id: string; title: string; folder: string }[];
};

/** Assigned = published web quizzes in the student's open folders; done = submitted at least once. */
export function progressOf(student: Doc<"students">, folders: Doc<"folders">[], quizzes: Doc<"quizzes">[], doneQuizIds: Set<Id<"quizzes">>): Progress {
  const byFolder: Progress["byFolder"] = [];
  const pending: Progress["pending"] = [];
  let total = 0;
  let done = 0;
  for (const f of folders) {
    if (!canOpen(student, f.slug)) continue;
    const list = quizzes.filter((q) => q.published && q.folder === f.slug);
    if (!list.length) continue;
    const d = list.filter((q) => doneQuizIds.has(q._id)).length;
    byFolder.push({ id: f.slug, name: f.name, total: list.length, done: d, rate: percent(d, list.length) });
    pending.push(...list.filter((q) => !doneQuizIds.has(q._id)).map((q) => ({ id: q.slug, title: q.title, folder: f.name })));
    total += list.length;
    done += d;
  }
  return { total, done, rate: percent(done, total), byFolder, pending };
}

export async function progressFor(ctx: Ctx, student: Doc<"students">) {
  const folders = await allFolders(ctx);
  const quizzes = (await ctx.db.query("quizzes").collect()).sort((a, b) => a.order - b.order);
  const attempts = await ctx.db.query("attempts").withIndex("by_student", (q) => q.eq("studentId", student._id)).collect();
  return progressOf(student, folders, quizzes, new Set(attempts.map((a) => a.quizId)));
}

/* ======================= admin views ======================= */

export const leaderboard = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const { tests, scores } = await ieltsBoard(ctx);
    const students = (await ctx.db.query("students").collect()).filter((s) => scores[s._id]);
    return {
      tests,
      rows: students.map((s) => ({ id: s._id, name: s.name, className: s.className, code: s.code, scores: scores[s._id] })),
    };
  },
});

export const attendance = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const folders = await allFolders(ctx);
    const quizzes = await ctx.db.query("quizzes").collect();
    const attempts = await ctx.db.query("attempts").collect();
    const doneBy = new Map<string, Set<Id<"quizzes">>>();
    for (const a of attempts) (doneBy.get(a.studentId) ?? doneBy.set(a.studentId, new Set()).get(a.studentId)!).add(a.quizId);
    const students = (await ctx.db.query("students").collect()).filter((s) => s.active);
    return students
      .map((s) => {
        const p = progressOf(s, folders, quizzes, doneBy.get(s._id) ?? new Set());
        return { id: s._id, name: s.name, className: s.className, code: s.code, total: p.total, done: p.done, rate: p.rate, byFolder: p.byFolder, pending: p.pending.length };
      })
      .sort((a, b) => a.className.localeCompare(b.className, "vi") || a.name.localeCompare(b.name, "vi"));
  },
});

/* ======================= parent codes ======================= */

export async function parentByCode(ctx: Ctx, code: string) {
  const c = normCode(code);
  if (!c) return null;
  return ctx.db.query("students").withIndex("by_parentCode", (q) => q.eq("parentCode", c)).first();
}

/** "baoan" + "ph" + 4 digits; never equal to a student code. */
export async function generateParentCode(ctx: Ctx, name: string) {
  const base = (lastTwoWords(name) || "hs") + "ph";
  for (let i = 0; i < 50; i++) {
    const code = base + String(Math.floor(1000 + Math.random() * 9000));
    const clash =
      (await parentByCode(ctx, code)) || (await ctx.db.query("students").withIndex("by_code", (q) => q.eq("code", code)).first());
    if (!clash) return code;
  }
  return base + Math.random().toString(36).slice(2, 8);
}

/** Gives every student without one a parent code. */
export const fillParentCodes = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    let n = 0;
    for (const s of await ctx.db.query("students").collect())
      if (!s.parentCode) {
        await ctx.db.patch(s._id, { parentCode: await generateParentCode(ctx, s.name) });
        n++;
      }
    return n;
  },
});

export const regenerateParentCode = mutation({
  args: { token: v.string(), id: v.id("students") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const s = await ctx.db.get(args.id);
    if (!s) fail("Không tìm thấy học sinh.");
    const code = await generateParentCode(ctx, s.name);
    await ctx.db.patch(s._id, { parentCode: code });
    for (const p of await ctx.db.query("parentSessions").withIndex("by_student", (q) => q.eq("studentId", s._id)).collect()) await ctx.db.delete(p._id);
    return code;
  },
});
