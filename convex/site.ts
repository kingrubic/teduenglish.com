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
  quizBySlug,
  quizMeta,
  randomToken,
  sha256,
  studentByCode,
  studentFromToken,
  studentResource,
} from "./lib";
import { bandFor, grade, isAnswered, isCorrect, normCode, type Answers } from "./model";

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
      .filter((r) => open.includes(r.folder))
      .sort((a, b) => a.order - b.order);

    return {
      ...base,
      student: publicStudent(student),
      dashboard: {
        openFolders: open,
        quizzes,
        resources: await Promise.all(resources.map((r) => studentResource(ctx, r))),
        done: await doneMapFor(ctx, student._id),
      },
    };
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
      .sort((a, b) => a.order - b.order);
    const info = { id: f.slug, badge: f.badge, name: f.name, detail: f.detail, quizCount: quizzes.length, resourceCount: resources.length };
    if (!student) return { folder: info, status: "login" as const };
    if (!canOpen(student, f.slug)) return { folder: info, status: "noaccess" as const };
    return {
      folder: info,
      status: "ok" as const,
      quizzes: quizzes.map(quizMeta),
      resources: await Promise.all(resources.map((r) => studentResource(ctx, r))),
      done: await doneMapFor(ctx, student._id),
    };
  },
});

/** One uploaded PDF for the reader, only if the student may open its folder. */
export const document = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("resources", args.id);
    const r = id ? await ctx.db.get(id) : null;
    if (!r?.file) return null;
    const student = await studentFromToken(ctx, args.token);
    if (!student || !canOpen(student, r.folder)) return null;
    const folder = await folderBySlug(ctx, r.folder);
    return { ...(await studentResource(ctx, r)), folderName: folder?.name ?? "" };
  },
});

/** Quiz for taking: never includes answers or explanations. */
export const quiz = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    const quiz = await quizBySlug(ctx, args.id);
    if (!quiz || !quiz.published) return null;
    const f = await folderBySlug(ctx, quiz.folder);
    const meta = { ...quizMeta(quiz), folderName: f?.name ?? "" };
    const student = await studentFromToken(ctx, args.token);
    if (!student) return { meta, status: "login" as const };
    if (!canOpen(student, quiz.folder)) return { meta, status: "noaccess" as const };
    if (quiz.code) {
      const unlocked = await ctx.db
        .query("quizUnlocks")
        .withIndex("by_student_quiz", (q) => q.eq("studentId", student._id).eq("quizId", quiz._id))
        .first();
      if (!unlocked) return { meta, status: "locked" as const };
    }
    return {
      meta,
      status: "ok" as const,
      sections: quiz.sections.map((s) => ({
        title: s.title,
        listen: s.listen ?? null,
        passage: s.passage ?? null,
        questions: s.questions.map((q) =>
          q.type === "mcq"
            ? { type: "mcq" as const, tag: q.tag ?? "", q: q.q, options: q.options }
            : { type: "fill" as const, tag: q.tag ?? "", q: q.q },
        ),
      })),
    };
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
    token: v.string(),
    id: v.string(),
    answers: v.record(v.string(), v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const student = await studentFromToken(ctx, args.token);
    if (!student) fail("Phiên đăng nhập đã hết hạn, em đăng nhập lại để nộp bài.");
    const quiz = await quizBySlug(ctx, args.id);
    if (!quiz || !quiz.published || !canOpen(student, quiz.folder)) fail("Không tìm thấy bài này.");
    if (quiz.code) {
      const unlocked = await ctx.db
        .query("quizUnlocks")
        .withIndex("by_student_quiz", (q) => q.eq("studentId", student._id).eq("quizId", quiz._id))
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
      }),
    );

    const result = grade(quiz.sections, answers);
    const band = bandFor(quiz.ielts, result.correct, result.total);
    const now = Date.now();
    await ctx.db.insert("attempts", {
      studentId: student._id,
      quizId: quiz._id,
      ...result,
      band: band ?? undefined,
      answers,
      submittedAt: now,
    });
    await ctx.db.patch(student._id, { lastSeenAt: now });

    const review: Record<string, { ok: boolean; answered: boolean; answer: number | string; explain: string }> = {};
    quiz.sections.forEach((sec, si) =>
      sec.questions.forEach((q, qi) => {
        const key = `${si}-${qi}`;
        review[key] = {
          ok: isCorrect(q, answers[key]),
          answered: isAnswered(q, answers[key]),
          answer: q.type === "mcq" ? q.answer : q.answer[0] ?? "",
          explain: q.explain ?? "",
        };
      }),
    );
    return { result: { ...result, band }, review, submittedAt: now };
  },
});
