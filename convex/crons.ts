import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/** Removes expired sessions and login attempts older than a day. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oldStudent = await ctx.db.query("studentSessions").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(500);
    for (const s of oldStudent) await ctx.db.delete(s._id);
    const oldAdmin = await ctx.db.query("adminSessions").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(500);
    for (const s of oldAdmin) await ctx.db.delete(s._id);
    // Uploads that never got attached to a resource (form closed before saving).
    const used = new Set((await ctx.db.query("resources").collect()).flatMap((r) => (r.file ? [r.file.storageId] : [])));
    const files = await ctx.db.system.query("_storage").collect();
    for (const f of files) if (!used.has(f._id) && f._creationTime < now - 24 * 60 * 60 * 1000) await ctx.storage.delete(f._id);
    for (const kind of ["student", "admin"] as const) {
      const old = await ctx.db.query("loginAttempts").withIndex("by_kind_at", (q) => q.eq("kind", kind).lt("at", now - 24 * 60 * 60 * 1000)).take(1000);
      for (const a of old) await ctx.db.delete(a._id);
    }
  },
});

const crons = cronJobs();
crons.daily("cleanup sessions", { hourUTC: 19, minuteUTC: 0 }, internal.crons.cleanup);
export default crons;
