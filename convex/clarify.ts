import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { MAX_CLARIFY_FILE_BYTES, QUESTION_IDS } from "./clarifyData";
import { fail, previewAdmin } from "./lib";

/* /need-clarify: the teacher answers open questions. Access with the secret link key
 * (Convex env CLARIFY_KEY) or a signed-in admin session. */

const access = { key: v.optional(v.string()), adminToken: v.optional(v.string()) };

async function allowed(ctx: QueryCtx, args: { key?: string; adminToken?: string }) {
  const secret = process.env.CLARIFY_KEY;
  if (secret && args.key && args.key === secret) return true;
  return !!(await previewAdmin(ctx, args.adminToken));
}

async function withUrls(ctx: QueryCtx, a: Doc<"clarifyAnswers">) {
  return {
    qid: a.qid,
    choices: a.choices,
    text: a.text,
    by: a.by,
    updatedAt: a.updatedAt,
    files: await Promise.all(a.files.map(async (f) => ({ ...f, url: await ctx.storage.getUrl(f.storageId) }))),
  };
}

export const answers = query({
  args: access,
  handler: async (ctx, args) => {
    if (!(await allowed(ctx, args))) return null;
    const rows = await ctx.db.query("clarifyAnswers").collect();
    return Promise.all(rows.map((a) => withUrls(ctx, a)));
  },
});

async function rowFor(ctx: QueryCtx, qid: string) {
  if (!QUESTION_IDS.has(qid)) fail("Câu hỏi không tồn tại.");
  return ctx.db.query("clarifyAnswers").withIndex("by_qid", (q) => q.eq("qid", qid)).unique();
}

export const save = mutation({
  args: { ...access, qid: v.string(), choices: v.array(v.string()), text: v.string(), by: v.string() },
  handler: async (ctx, args) => {
    if (!(await allowed(ctx, args))) fail("Link không hợp lệ hoặc đã hết hạn.");
    const row = await rowFor(ctx, args.qid);
    const data = { choices: args.choices.slice(0, 10).map((c) => c.slice(0, 200)), text: args.text.slice(0, 10_000), by: args.by.trim().slice(0, 80), updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, data);
    else await ctx.db.insert("clarifyAnswers", { qid: args.qid, files: [], ...data });
  },
});

export const uploadUrl = mutation({
  args: access,
  handler: async (ctx, args) => {
    if (!(await allowed(ctx, args))) fail("Link không hợp lệ hoặc đã hết hạn.");
    return ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: { ...access, qid: v.string(), storageId: v.id("_storage"), name: v.string(), by: v.string() },
  handler: async (ctx, args) => {
    if (!(await allowed(ctx, args))) fail("Link không hợp lệ hoặc đã hết hạn.");
    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) fail("File tải lên không còn, vui lòng chọn lại.");
    if (meta.size > MAX_CLARIFY_FILE_BYTES) fail("File quá lớn (tối đa 100 MB).");
    const file = { storageId: args.storageId, name: args.name.split(/[\\/]/).pop()!.slice(0, 160) || "file", size: meta.size };
    const row = await rowFor(ctx, args.qid);
    if (row) {
      if (row.files.length >= 20) fail("Mỗi câu đính kèm tối đa 20 file.");
      await ctx.db.patch(row._id, { files: [...row.files, file], updatedAt: Date.now() });
    } else await ctx.db.insert("clarifyAnswers", { qid: args.qid, choices: [], text: "", files: [file], by: args.by.trim().slice(0, 80), updatedAt: Date.now() });
  },
});

export const detach = mutation({
  args: { ...access, qid: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    if (!(await allowed(ctx, args))) fail("Link không hợp lệ hoặc đã hết hạn.");
    const row = await rowFor(ctx, args.qid);
    if (!row) return;
    await ctx.db.patch(row._id, { files: row.files.filter((f) => f.storageId !== args.storageId), updatedAt: Date.now() });
    await ctx.storage.delete(args.storageId);
  },
});

/** For reading the answers from the CLI: npx convex run clarify:dump */
export const dump = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("clarifyAnswers").collect();
    return Promise.all(rows.map((a) => withUrls(ctx, a)));
  },
});

/** Wipes every answer and attachment. Only for clearing test data before sending the link. */
export const resetAll = internalMutation({
  args: { confirm: v.literal("xoa-het") },
  handler: async (ctx) => {
    for (const a of await ctx.db.query("clarifyAnswers").collect()) {
      for (const f of a.files) await ctx.storage.delete(f.storageId);
      await ctx.db.delete(a._id);
    }
  },
});
