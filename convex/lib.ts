import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { firstName, noMarks, normCode, questionCount } from "./model";

export const STUDENT_SESSION_MS = 180 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function fail(message: string): never {
  throw new ConvexError(message);
}

/* ---------- crypto ---------- */
function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

export async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const candidate = await pbkdf2(password, fromHex(salt), Number(iter));
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function checkPasswordStrength(password: string) {
  if (password.length < 8) fail("Mật khẩu cần ít nhất 8 ký tự.");
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
    fail("Mật khẩu cần có cả chữ và số.");
}

/* ---------- sessions ---------- */
type Ctx = QueryCtx | MutationCtx;

export async function studentFromToken(ctx: Ctx, token: string | undefined | null) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await ctx.db
    .query("studentSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!row || row.expiresAt < Date.now()) return null;
  const student = await ctx.db.get(row.studentId);
  if (!student || !student.active) return null;
  return student;
}

export async function adminFromToken(ctx: Ctx, token: string | undefined | null) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await ctx.db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!row || row.expiresAt < Date.now()) return null;
  const admin = await ctx.db.get(row.adminId);
  if (!admin || !admin.active) return null;
  return admin;
}

/** Throws unless the token belongs to an active admin who has set their own password. */
export async function requireAdmin(ctx: Ctx, token: string, opts: { owner?: boolean } = {}) {
  const admin = await adminFromToken(ctx, token);
  if (!admin) fail("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  if (admin.mustChangePassword) fail("Bạn cần đổi mật khẩu trước khi tiếp tục.");
  if (opts.owner && admin.role !== "owner") fail("Chỉ quản trị viên chính mới làm được việc này.");
  return admin;
}

/* ---------- data helpers ---------- */
export async function getSettings(ctx: Ctx) {
  const row = await ctx.db.query("settings").first();
  return {
    centerName: row?.centerName ?? "TEDU English",
    tagline: row?.tagline ?? "Better English · Brighter Futures",
    teacher: row?.teacher ?? "thầy cô",
    contact: row?.contact ?? "",
    showDemoHint: row?.showDemoHint ?? false,
    demoCode: row?.demoCode ?? "",
  };
}

export async function allFolders(ctx: Ctx) {
  const rows = await ctx.db.query("folders").collect();
  return rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function canOpen(student: Doc<"students"> | null, folder: string) {
  if (!student) return false;
  return student.folders.includes("*") || student.folders.includes(folder);
}

export async function studentByCode(ctx: Ctx, code: string) {
  const c = normCode(code);
  if (!c) return null;
  return ctx.db
    .query("students")
    .withIndex("by_code", (q) => q.eq("code", c))
    .first();
}

export function quizMeta(quiz: Doc<"quizzes">) {
  return {
    id: quiz.slug,
    folder: quiz.folder,
    title: quiz.title,
    subtitle: quiz.subtitle,
    minutes: quiz.minutes,
    hasCode: quiz.code !== "",
    featured: quiz.featured,
    ielts: quiz.ielts ?? null,
    questionCount: questionCount(quiz.sections),
  };
}

export type DoneRecord = { best: number; last: number; total: number; at: number; count: number };

export async function doneMapFor(ctx: Ctx, studentId: Id<"students">) {
  const attempts = await ctx.db
    .query("attempts")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .order("asc")
    .collect();
  const map: Record<string, DoneRecord> = {};
  const slugs = new Map<Id<"quizzes">, string | null>();
  for (const a of attempts) {
    if (!slugs.has(a.quizId)) slugs.set(a.quizId, (await ctx.db.get(a.quizId))?.slug ?? null);
    const slug = slugs.get(a.quizId);
    if (!slug) continue;
    const prev = map[slug];
    map[slug] = {
      best: Math.max(prev?.best ?? 0, a.correct),
      last: a.correct,
      total: a.total,
      at: a.submittedAt,
      count: (prev?.count ?? 0) + 1,
    };
  }
  return map;
}

/** Resource as shown to a student who may open its folder. */
export async function studentResource(ctx: Ctx, r: Doc<"resources">) {
  return {
    id: r._id,
    folder: r.folder,
    kind: r.kind,
    title: r.title,
    description: r.description,
    url: r.url,
    file: r.file ? { name: r.file.name, size: r.file.size, url: await ctx.storage.getUrl(r.file.storageId) } : null,
  };
}

export async function quizBySlug(ctx: Ctx, slug: string) {
  return ctx.db
    .query("quizzes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export async function folderBySlug(ctx: Ctx, slug: string) {
  return ctx.db
    .query("folders")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/** Random readable student code: first name without accents + 4 digits. */
export async function generateStudentCode(ctx: Ctx, name: string) {
  const base = noMarks(firstName(name)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "hs";
  for (let i = 0; i < 50; i++) {
    const code = base + String(Math.floor(1000 + Math.random() * 9000));
    if (!(await studentByCode(ctx, code))) return code;
  }
  return base + randomToken(3);
}
