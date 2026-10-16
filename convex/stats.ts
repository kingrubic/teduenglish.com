import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { allFolders, canOpen, requireAdmin } from "./lib";
import { SPEAKING_REVIEW_KEY, bandFor, hasEssay, hasSpeak, maskedName, normCode, parentCodeFor, percent, rankBy, writingTestBand, type IeltsSkill } from "./model";

type Ctx = QueryCtx | MutationCtx;

/* ======================= IELTS bands ======================= */

/** From the quiz setting; otherwise Speaking/Writing for recorded or written tests in the IELTS folder. */
export function skillOf(q: Doc<"quizzes">): IeltsSkill | null {
  if (q.ielts) return q.ielts;
  if (q.folder !== "ielts") return null;
  return hasSpeak(q.sections) ? "speaking" : hasEssay(q.sections) ? "writing" : null;
}

/** Band of one attempt; Writing needs every task marked, Speaking the teacher's overall band. */
export function attemptBand(q: Doc<"quizzes">, a: Doc<"attempts">, skill: IeltsSkill): number | null {
  if (skill === "speaking") return a.essayReviews?.[SPEAKING_REVIEW_KEY]?.band ?? null;
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

export type RankScope = "all" | IeltsSkill;
export type RankRow = { rank: number; label: string; me: boolean; average: number; tests: number };

/**
 * IELTS ranking inside the student's class, shown to the student only (parents never see it).
 * Classmates appear as masked names; tables keep the top 10 plus the student's own row.
 */
export async function classRanking(ctx: Ctx, student: Doc<"students">) {
  const { tests, scores } = await ieltsBoard(ctx);
  const mine = scores[student._id] ?? {};
  const classmates = (await ctx.db.query("students").withIndex("by_class", (q) => q.eq("className", student.className)).collect()).filter(
    (s) => s.active || s._id === student._id,
  );

  const perTest = tests
    .filter((t) => mine[t.id] != null)
    .map((t) => {
      const ranked = rankBy(
        classmates.filter((s) => scores[s._id]?.[t.id] != null),
        (s) => scores[s._id][t.id],
      );
      return { id: t.id, title: t.title, skill: t.skill, band: mine[t.id], rank: ranked.find((r) => r.item._id === student._id)!.rank, of: ranked.length };
    });

  const scopes: { scope: RankScope; myRank: number | null; of: number; table: RankRow[] }[] = [];
  for (const scope of ["all", "listening", "reading", "writing", "speaking"] as RankScope[]) {
    const ids = tests.filter((t) => scope === "all" || t.skill === scope).map((t) => t.id);
    const avg = (id: string) => {
      const vals = ids.map((t) => scores[id]?.[t]).filter((x): x is number => x != null);
      return vals.length ? { average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, tests: vals.length } : null;
    };
    const rows = classmates.map((s) => ({ s, a: avg(s._id) })).filter((x): x is { s: Doc<"students">; a: { average: number; tests: number } } => !!x.a);
    if (!rows.length) continue;
    const table = rankBy(rows, (x) => x.a.average).map((r) => ({
      rank: r.rank,
      label: r.item.s._id === student._id ? student.name : maskedName(r.item.s._id),
      me: r.item.s._id === student._id,
      average: r.item.a.average,
      tests: r.item.a.tests,
    }));
    scopes.push({ scope, myRank: table.find((r) => r.me)?.rank ?? null, of: table.length, table: table.filter((r, i) => i < 10 || r.me) });
  }
  return { className: student.className, perTest, scopes };
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

/** Keeps a student's parent code in step with their student code; returns true when it changed. */
export async function syncParentCode(ctx: MutationCtx, s: Doc<"students">) {
  const parentCode = parentCodeFor(s.code);
  if (s.parentCode === parentCode) return false;
  await ctx.db.patch(s._id, { parentCode });
  return true;
}

/** Recomputes every parent code from the student code (e.g. after the format changed). */
async function syncAll(ctx: MutationCtx) {
  let n = 0;
  for (const s of await ctx.db.query("students").collect()) if (await syncParentCode(ctx, s)) n++;
  return n;
}

export const fillParentCodes = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    return syncAll(ctx);
  },
});

/** npx convex run stats:syncParentCodes */
export const syncParentCodes = internalMutation({ args: {}, handler: (ctx) => syncAll(ctx) });
