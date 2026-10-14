import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { folderBySlug, getSettings, randomToken, sha256 } from "./lib";
import { maskedName, normCode, percent, rankBy, WRITING_CRITERIA } from "./model";
import { attemptBand, ieltsBoard, parentByCode, progressFor, skillOf } from "./stats";

/* /phu-huynh: parents follow their child with a read-only parent code. */

const PARENT_SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const FAILS_PER_MINUTE = 40;

async function childFromToken(ctx: QueryCtx, token: string | undefined) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await ctx.db.query("parentSessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  if (!row || row.expiresAt < Date.now()) return null;
  const s = await ctx.db.get(row.studentId);
  return s && s.active ? s : null;
}

export const login = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const code = normCode(args.code);
    if (!code) return { ok: false, error: "Nhập mã phụ huynh do giáo viên cấp." };
    const now = Date.now();
    const fails = await ctx.db
      .query("loginAttempts")
      .withIndex("by_kind_at", (q) => q.eq("kind", "student").gt("at", now - 60_000))
      .filter((q) => q.eq(q.field("ok"), false))
      .collect();
    if (fails.length >= FAILS_PER_MINUTE) return { ok: false, error: "Hệ thống đang bận, vui lòng thử lại sau 1 phút." };
    const s = await parentByCode(ctx, code);
    if (!s || !s.active) {
      await ctx.db.insert("loginAttempts", { kind: "student", key: `ph:${code}`.slice(0, 40), ok: false, at: now });
      return { ok: false, error: "Mã phụ huynh chưa đúng. Vui lòng kiểm tra lại hoặc liên hệ giáo viên." };
    }
    const tok = randomToken();
    await ctx.db.insert("parentSessions", { studentId: s._id, tokenHash: await sha256(tok), expiresAt: now + PARENT_SESSION_MS });
    return { ok: true, token: tok };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);
    const row = await ctx.db.query("parentSessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const child = await childFromToken(ctx, args.token);
    if (!child) return null;
    const settings = await getSettings(ctx);
    const progress = await progressFor(ctx, child);

    // Results: best score per quiz the child has submitted.
    const attempts = await ctx.db.query("attempts").withIndex("by_student", (q) => q.eq("studentId", child._id)).collect();
    const byQuiz = new Map<string, Doc<"attempts">[]>();
    for (const a of attempts) (byQuiz.get(a.quizId) ?? byQuiz.set(a.quizId, []).get(a.quizId)!).push(a);
    const results = [];
    for (const [quizId, list] of byQuiz) {
      const q = await ctx.db.get(quizId as Doc<"quizzes">["_id"]);
      if (!q) continue;
      const skill = skillOf(q);
      const scored = list.filter((a) => a.total > 0);
      const best = scored.sort((a, b) => b.correct / b.total - a.correct / a.total)[0];
      const bands = skill ? list.map((a) => attemptBand(q, a, skill)).filter((b): b is number => b != null) : [];
      const lastWriting = list.filter((a) => a.reviewStatus).sort((a, b) => b.submittedAt - a.submittedAt)[0];
      const essays: { prompt: string; band: number | null; criteria: { name: string; band: number }[]; comment: string }[] = [];
      if (lastWriting)
        q.sections.forEach((sec, si) =>
          sec.questions.forEach((qq, qi) => {
            if (qq.type !== "essay") return;
            const r = lastWriting.essayReviews?.[`${si}-${qi}`];
            essays.push({
              prompt: qq.tag || qq.q.split("\n")[0].slice(0, 80),
              band: r?.band ?? null,
              criteria: (r?.criteria ?? []).map((b, i) => ({ name: WRITING_CRITERIA[i], band: b })),
              comment: r?.comment ?? "",
            });
          }),
        );
      results.push({
        id: q.slug,
        title: q.title,
        folder: (await folderBySlug(ctx, q.folder))?.name ?? q.folder,
        skill,
        attempts: list.length,
        lastAt: Math.max(...list.map((a) => a.submittedAt)),
        best: best ? { correct: best.correct, total: best.total, pct: percent(best.correct, best.total) } : null,
        band: bands.length ? Math.max(...bands) : null,
        writing: lastWriting ? { status: lastWriting.reviewStatus!, essays } : null,
      });
    }
    results.sort((a, b) => b.lastAt - a.lastAt);

    // IELTS ranking inside the child's class.
    const { tests, scores } = await ieltsBoard(ctx);
    const classmates = (await ctx.db.query("students").withIndex("by_class", (q) => q.eq("className", child.className)).collect()).filter((s) => s.active);
    const avg = (id: string) => {
      const vals = Object.values(scores[id] ?? {});
      return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
    };
    const perTest = tests
      .filter((t) => scores[child._id]?.[t.id] != null)
      .map((t) => {
        const ranked = rankBy(
          classmates.filter((s) => scores[s._id]?.[t.id] != null),
          (s) => scores[s._id][t.id],
        );
        return { id: t.id, title: t.title, skill: t.skill, band: scores[child._id][t.id], rank: ranked.find((r) => r.item._id === child._id)!.rank, of: ranked.length };
      });
    const overall = rankBy(
      classmates.filter((s) => avg(s._id) != null),
      (s) => avg(s._id)!,
    );
    const table = overall.map((r) => ({
      rank: r.rank,
      label: r.item._id === child._id ? child.name : maskedName(r.item.code),
      me: r.item._id === child._id,
      average: Math.round(avg(r.item._id)! * 10) / 10,
      tests: Object.keys(scores[r.item._id] ?? {}).length,
    }));

    return {
      child: { name: child.name, className: child.className },
      teacher: settings.teacher,
      centerName: settings.centerName,
      progress,
      results,
      ranking: { perTest, table: table.filter((r, i) => i < 10 || r.me), myRank: table.find((r) => r.me)?.rank ?? null, of: table.length },
    };
  },
});
