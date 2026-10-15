import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  STUDENT_SESSION_MS,
  allFolders,
  canOpen,
  doneMapFor,
  fail,
  folderBySlug,
  getSettings,
  previewAdmin,
  publicSections,
  quizBySlug,
  quizMeta,
  randomToken,
  sha256,
  studentByCode,
  studentFromToken,
  studentResource,
  isMastered,
  studentQuizAttempts,
} from "./lib";
import { classRanking, progressFor } from "./stats";
import { MAX_ESSAY_CHARS, bandFor, grade, hasEssay, isAnswered, isCorrect, normCode, wordCount, type Answers } from "./model";

const token = v.optional(v.string());

function publicStudent(s: { name: string; className: string; folders: string[] }) {
  return { name: s.name, className: s.className, folders: s.folders };
}

/* ---------- reads ---------- */

/** Everything the header, footer and home page need. */
export const home = query({
  args: { token },
  handler: async (ctx, args) => {
    const settings = await getSettings(ctx);
    const folders = await allFolders(ctx);
    const student = await studentFromToken(ctx, args.token);
    const base = {
      settings: {
        centerName: settings.centerName,
        tagline: settings.tagline,
        teacher: settings.teacher,
        contact: settings.contact,
        demoCode: settings.showDemoHint ? settings.demoCode : "",
      },
      folders: folders.map((f) => ({ id: f.slug, badge: f.badge, name: f.name, detail: f.detail })),
    };
    if (!student) return { ...base, student: null, dashboard: null };

    const open = folders.filter((f) => canOpen(student, f.slug)).map((f) => f.slug);
    const quizzes = (await ctx.db.query("quizzes").collect())
      .filter((q) => q.published && open.includes(q.folder))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map(quizMeta);
    const resources = (await ctx.db.query("resources").collect())
      .filter((r) => open.includes(r.folder) && !r.hidden)
      .sort((a, b) => a.order - b.order);

    return {
      ...base,
      student: publicStudent(student),
      dashboard: {
        openFolders: open,
        quizzes,
        resources: await Promise.all(resources.map((r) => studentResource(ctx, r))),
        done: await doneMapFor(ctx, student._id, settings.lockAtPercent),
        progress: await progressFor(ctx, student),
      },
    };
  },
});

/** The student's IELTS place in their class. Students only: the parent view has no ranking. */
export const ranking = query({
  args: { token },
  handler: async (ctx, args) => {
    const student = await studentFromToken(ctx, args.token);
    return student ? classRanking(ctx, student) : null;
  },
});

export const folder = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    const f = await folderBySlug(ctx, args.id);
    if (!f) return null;
    const student = await studentFromToken(ctx, args.token);
    const quizzes = (await ctx.db.query("quizzes").withIndex("by_folder", (q) => q.eq("folder", f.slug)).collect())
      .filter((q) => q.published)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    const resources = (await ctx.db.query("resources").withIndex("by_folder", (q) => q.eq("folder", f.slug)).collect())
      .filter((r) => !r.hidden)
      .sort((a, b) => a.order - b.order);
    const info = { id: f.slug, badge: f.badge, name: f.name, detail: f.detail, quizCount: quizzes.length, resourceCount: resources.length };
    if (!student) return { folder: info, status: "login" as const };
    if (!canOpen(student, f.slug)) return { folder: info, status: "noaccess" as const };
    return {
      folder: info,
      status: "ok" as const,
      quizzes: quizzes.map(quizMeta),
      resources: await Promise.all(resources.map((r) => studentResource(ctx, r))),
      done: await doneMapFor(ctx, student._id, (await getSettings(ctx)).lockAtPercent),
    };
  },
});

/** One uploaded PDF for the reader, only if the student may open its folder. */
export const document = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("resources", args.id);
    const r = id ? await ctx.db.get(id) : null;
    if (!r?.file || r.hidden) return null;
    const student = await studentFromToken(ctx, args.token);
    if (!student || !canOpen(student, r.folder)) return null;
    const folder = await folderBySlug(ctx, r.folder);
    return { ...(await studentResource(ctx, r)), folderName: folder?.name ?? "" };
  },
});

/**
 * Quiz for taking: never includes answers or explanations.
 * A signed-in teacher without a student session gets a preview (drafts and coded quizzes included).
 */
export const quiz = query({
  args: { token, adminToken: v.optional(v.string()), id: v.string() },
  handler: async (ctx, args) => {
    const quiz = await quizBySlug(ctx, args.id);
    if (!quiz) return null;
    const f = await folderBySlug(ctx, quiz.folder);
    const { lockAtPercent } = await getSettings(ctx);
    const meta = { ...quizMeta(quiz), folderName: f?.name ?? "", published: quiz.published, lockAtPercent };
    const student = await studentFromToken(ctx, args.token);
    if (!student || !canOpen(student, quiz.folder) || !quiz.published) {
      if (await previewAdmin(ctx, args.adminToken)) return { meta, status: "ok" as const, preview: true, sections: await publicSections(ctx, quiz) };
    }
    if (!quiz.published) return null;
    if (!student) return { meta, status: "login" as const };
    if (!canOpen(student, quiz.folder)) return { meta, status: "noaccess" as const };
    const mine = await studentQuizAttempts(ctx, student._id, quiz._id);
    if (isMastered(mine, lockAtPercent)) {
      const best = mine.filter((a) => !a.reopened && a.total > 0).sort((a, b) => b.correct / b.total - a.correct / a.total)[0];
      return { meta, status: "mastered" as const, best: { correct: best.correct, total: best.total, at: best.submittedAt } };
    }
    if (quiz.code) {
      const unlocked = await ctx.db
        .query("quizUnlocks")
        .withIndex("by_student_quiz", (q) => q.eq("studentId", student._id).eq("quizId", quiz._id))
        .first();
      if (!unlocked) return { meta, status: "locked" as const };
    }
    return { meta, status: "ok" as const, preview: false, sections: await publicSections(ctx, quiz) };
  },
});

/** The student's own writing for a quiz, with the teacher's comments once marked. */
export const writing = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    const student = await studentFromToken(ctx, args.token);
    const quiz = await quizBySlug(ctx, args.id);
    if (!student || !quiz || !hasEssay(quiz.sections)) return [];
    const attempts = (await ctx.db.query("attempts").withIndex("by_student", (q) => q.eq("studentId", student._id)).order("desc").collect())
      .filter((a) => a.quizId === quiz._id && a.reviewStatus)
      .slice(0, 10);
    return attempts.map((a) => ({
      id: a._id,
      submittedAt: a.submittedAt,
      status: a.reviewStatus!,
      reviewedBy: a.reviewedBy ?? null,
      essays: quiz.sections.flatMap((sec, si) =>
        sec.questions.flatMap((q, qi) => {
          if (q.type !== "essay") return [];
          const key = `${si}-${qi}`;
          const text = String(a.answers[key] ?? "");
          const review = a.essayReviews?.[key];
          return [{ key, prompt: q.q, text, words: wordCount(text), minWords: q.minWords ?? 0, comment: review?.comment ?? "", band: review?.band ?? null, criteria: review?.criteria ?? null }];
        }),
      ),
    }));
  },
});

/* ---------- writes ---------- */

const STUDENT_FAILS_PER_MINUTE = 40;

/**
 * Expected failures are returned, not thrown: a thrown error would roll back the
 * failed-attempt row that powers the throttle.
 */
export const login = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; token: string; name: string } | { ok: false; error: string }> => {
    const code = normCode(args.code);
    if (!code) return { ok: false, error: "Em nhập mã cá nhân trước nhé." };
    const now = Date.now();
    // Coarse global brake against guessing codes: legit typos never get close to this.
    const recentFails = await ctx.db
      .query("loginAttempts")
      .withIndex("by_kind_at", (q) => q.eq("kind", "student").gt("at", now - 60_000))
      .filter((q) => q.eq(q.field("ok"), false))
      .collect();
    if (recentFails.length >= STUDENT_FAILS_PER_MINUTE)
      return { ok: false, error: "Hệ thống đang bận, em thử lại sau 1 phút nhé." };

    const settings = await getSettings(ctx);
    const student = await studentByCode(ctx, code);
    if (!student || !student.active) {
      await ctx.db.insert("loginAttempts", { kind: "student", key: code.slice(0, 40), ok: false, at: now });
      return { ok: false, error: `Không tìm thấy mã này. Em kiểm tra lại hoặc nhắn ${settings.teacher} để được cấp lại.` };
    }
    const tok = randomToken();
    await ctx.db.insert("studentSessions", {
      studentId: student._id,
      tokenHash: await sha256(tok),
      expiresAt: now + STUDENT_SESSION_MS,
    });
    await ctx.db.patch(student._id, { lastSeenAt: now });
    return { ok: true, token: tok, name: student.name };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);
    const row = await ctx.db
      .query("studentSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const unlock = mutation({
  args: { token: v.string(), id: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; error: string }> => {
    const student = await studentFromToken(ctx, args.token);
    if (!student) return { ok: false, error: "Phiên đăng nhập đã hết hạn, em đăng nhập lại nhé." };
    const quiz = await quizBySlug(ctx, args.id);
    if (!quiz || !quiz.published || !canOpen(student, quiz.folder)) return { ok: false, error: "Không tìm thấy bài này." };
    const settings = await getSettings(ctx);
    if (normCode(args.code) !== normCode(quiz.code))
      return { ok: false, error: `Mã bài chưa đúng. Em hỏi lại ${settings.teacher} mã của bài này.` };
    const existing = await ctx.db
      .query("quizUnlocks")
      .withIndex("by_student_quiz", (q) => q.eq("studentId", student._id).eq("quizId", quiz._id))
      .first();
    if (!existing) await ctx.db.insert("quizUnlocks", { studentId: student._id, quizId: quiz._id });
    return { ok: true };
  },
});

export const submit = mutation({
  args: {
    token: v.optional(v.string()),
    adminToken: v.optional(v.string()),
    id: v.string(),
    answers: v.record(v.string(), v.union(v.string(), v.number())),
    durationSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const quiz = await quizBySlug(ctx, args.id);
    if (!quiz) fail("Không tìm thấy bài này.");
    const student = await studentFromToken(ctx, args.token);
    const studentMayTake = !!student && quiz.published && canOpen(student, quiz.folder);
    // Teacher preview: graded the same way, but nothing is saved.
    const preview = !studentMayTake && !!(await previewAdmin(ctx, args.adminToken));
    if (!studentMayTake && !preview) fail(student ? "Không tìm thấy bài này." : "Phiên đăng nhập đã hết hạn, em đăng nhập lại để nộp bài.");
    const { lockAtPercent } = await getSettings(ctx);
    if (!preview && isMastered(await studentQuizAttempts(ctx, student!._id, quiz._id), lockAtPercent))
      fail(`Em đã hoàn thành bài này từ ${lockAtPercent}% trở lên nên bài đã được khoá.`);
    if (!preview && quiz.code) {
      const unlocked = await ctx.db
        .query("quizUnlocks")
        .withIndex("by_student_quiz", (q) => q.eq("studentId", student!._id).eq("quizId", quiz._id))
        .first();
      if (!unlocked) fail("Bài này cần mã bài trước khi nộp.");
    }

    // Keep only answers that map to a real question, trimmed to a sane size.
    const answers: Answers = {};
    quiz.sections.forEach((sec, si) =>
      sec.questions.forEach((q, qi) => {
        const key = `${si}-${qi}`;
        const val = args.answers[key];
        if (q.type === "mcq" && typeof val === "number") answers[key] = val;
        if (q.type === "fill" && typeof val === "string") answers[key] = val.slice(0, 300);
        if (q.type === "essay" && typeof val === "string" && val.trim()) answers[key] = val.slice(0, MAX_ESSAY_CHARS);
      }),
    );
    const wroteEssay = quiz.sections.some((sec, si) => sec.questions.some((q, qi) => q.type === "essay" && wordCount(answers[`${si}-${qi}`]) > 0));

    const result = grade(quiz.sections, answers);
    const band = bandFor(quiz.ielts, result.correct, result.total);
    const now = Date.now();
    if (!preview) {
      await ctx.db.insert("attempts", {
        studentId: student!._id,
        quizId: quiz._id,
        ...result,
        band: band ?? undefined,
        answers,
        submittedAt: now,
        ...(args.durationSec != null ? { durationSec: Math.max(0, Math.min(86_400, Math.round(args.durationSec))) } : {}),
        ...(wroteEssay ? { reviewStatus: "pending" as const } : {}),
      });
      await ctx.db.patch(student!._id, { lastSeenAt: now });
    }

    // Answers and explanations only for questions the student actually answered; a blank
    // question keeps its answer hidden so it can't be copied on the next try or passed on.
    // The teacher's preview still shows every answer.
    const review: Record<string, { ok: boolean; answered: boolean; answer: number | string | null; explain: string; essay: boolean }> = {};
    quiz.sections.forEach((sec, si) =>
      sec.questions.forEach((q, qi) => {
        const key = `${si}-${qi}`;
        const answered = isAnswered(q, answers[key]);
        const reveal = (answered || preview) && q.type !== "essay";
        review[key] = {
          ok: isCorrect(q, answers[key]),
          answered,
          answer: !reveal ? null : q.type === "mcq" ? q.answer : q.type === "fill" ? q.answer[0] ?? "" : null,
          explain: reveal ? q.explain ?? "" : "",
          essay: q.type === "essay",
        };
      }),
    );
    return { result: { ...result, band }, review, submittedAt: now, preview, essayPending: wroteEssay && !preview };
  },
});
