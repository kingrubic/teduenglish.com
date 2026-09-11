import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { actorFromHash, firstTenant, menuKeysForUser } from "./helpers";

export const ping = query({
  args: {},
  handler: async (ctx) => {
    await ctx.db.query("tenants").first();
    return { ok: true };
  },
});

export const getActor = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => actorFromHash(ctx, args.tokenHash),
});

export const userByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();
    if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;
    return {
      id: user._id,
      passwordHash: user.passwordHash,
      role: user.role,
    };
  },
});

export const recentLoginFailures = query({
  args: { emailHash: v.string(), ipHash: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const rows = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email_ip", (q) =>
        q.eq("emailHash", args.emailHash).eq("ipHash", args.ipHash),
      )
      .collect();
    return rows.filter((row) => !row.succeeded && row.attemptedAt > cutoff)
      .length;
  },
});

export const recordLoginAttempt = mutation({
  args: {
    emailHash: v.string(),
    ipHash: v.string(),
    succeeded: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("loginAttempts", {
      ...args,
      attemptedAt: Date.now(),
    });
  },
});

export const createSession = mutation({
  args: { userId: v.id("users"), tokenHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
  },
});

export const destroySession = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

export const deleteUserSessions = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
  },
});

export const landingMenu = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const keys = await menuKeysForUser(ctx, user);
    const preferred = ["portal.dashboard", "cms.dashboard"];
    return preferred.find((key) => keys.includes(key)) ?? keys[0] ?? null;
  },
});

export const accessibleMenuKeys = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await actorFromHash(ctx, args.tokenHash);
    if (!actor) return [] as string[];
    if (actor.role === "ADMIN") return "ALL_ADMIN";
    if (actor.role === "MOD") return "ALL_MOD";
    const user = await ctx.db.get(actor.id);
    if (!user) return [];
    return menuKeysForUser(ctx, user);
  },
});

export const siteSettings = query({
  args: {},
  handler: async (ctx) => {
    const tenant = await firstTenant(ctx);
    if (!tenant) return null;
    const settings = await ctx.db
      .query("siteSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .unique();
    if (!settings) return null;
    return {
      tenantId: settings.tenantId,
      brandName: settings.brandName,
      tagline: settings.tagline,
      teacherName: settings.teacherName,
      teacherTitle: settings.teacherTitle,
      teacherOrganization: settings.teacherOrganization,
      teacherShortBio: settings.teacherShortBio,
      teacherLongBio: settings.teacherLongBio,
      contactEmail: settings.contactEmail ?? null,
      contactPhone: settings.contactPhone ?? null,
      seoTitle: settings.seoTitle,
      seoDescription: settings.seoDescription,
    };
  },
});

export const firstTenantId = query({
  args: {},
  handler: async (ctx) => (await firstTenant(ctx))?._id ?? null,
});
