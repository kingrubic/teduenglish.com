import { query } from "./_generated/server";
import { v } from "convex/values";
import { sessionLabel } from "./helpers";

export const publishedPrograms = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("programs")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    rows.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    const sliced = args.limit ? rows.slice(0, args.limit) : rows;
    return sliced.map((p) => ({
      id: p._id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      audience: p.audience,
      outcomes: p.outcomes,
    }));
  },
});

export const programBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query("programs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!program?.isPublished) return null;
    return {
      title: program.title,
      summary: program.summary,
      audience: program.audience,
      outcomes: program.outcomes,
    };
  },
});

export const homeClasses = query({
  args: {},
  handler: async (ctx) => {
    const classes = (await ctx.db.query("classes").collect()).filter((c) =>
      ["RECRUITING", "UPCOMING"].includes(c.recruitmentStatus),
    );
    classes.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
    const result = [];
    for (const cls of classes.slice(0, 3)) {
      const schedules = await ctx.db
        .query("classSchedules")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      schedules.sort((a, b) => a.weekday - b.weekday);
      result.push({
        id: cls._id,
        name: cls.name,
        code: cls.code,
        grade_min: cls.gradeMin,
        grade_max: cls.gradeMax,
        status: cls.recruitmentStatus,
        sessions: schedules.map((s) => sessionLabel(s.weekday, s.startsAt)).join(", "),
      });
    }
    return result;
  },
});

export const timetable = query({
  args: {},
  handler: async (ctx) => {
    const classes = (await ctx.db.query("classes").collect()).filter(
      (c) => c.recruitmentStatus !== "CLOSED",
    );
    const rank: Record<string, number> = {
      RECRUITING: 0,
      UPCOMING: 1,
      FULL: 2,
    };
    classes.sort(
      (a, b) =>
        (rank[a.recruitmentStatus] ?? 9) - (rank[b.recruitmentStatus] ?? 9) ||
        a.startsOn.localeCompare(b.startsOn),
    );
    const result = [];
    for (const cls of classes) {
      const program = cls.programId ? await ctx.db.get(cls.programId) : null;
      const schedules = await ctx.db
        .query("classSchedules")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      schedules.sort(
        (a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt),
      );
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      result.push({
        id: cls._id,
        code: cls.code,
        name: cls.name,
        gradeMin: cls.gradeMin,
        gradeMax: cls.gradeMax,
        programId: cls.programId ?? null,
        program: program?.title ?? null,
        level: cls.level,
        modality: cls.modality,
        location: cls.location ?? null,
        startsOn: cls.startsOn,
        status: cls.recruitmentStatus,
        capacity: cls.capacity ?? null,
        enrollmentCount: enrollments.filter((e) => e.status === "ACTIVE").length,
        showSeats: cls.publicRemainingSeats,
        isDemo: cls.isDemo,
        sessions: schedules.map((s) => ({
          weekday: s.weekday,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        })),
      });
    }
    return result;
  },
});

export const classDetail = query({
  args: { id: v.id("classes") },
  handler: async (ctx, args) => {
    const cls = await ctx.db.get(args.id);
    if (!cls || cls.recruitmentStatus === "CLOSED") return null;
    const program = cls.programId ? await ctx.db.get(cls.programId) : null;
    const schedules = await ctx.db
      .query("classSchedules")
      .withIndex("by_class", (q) => q.eq("classId", cls._id))
      .collect();
    schedules.sort(
      (a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt),
    );
    return {
      class: {
        id: cls._id,
        name: cls.name,
        code: cls.code,
        grade_min: cls.gradeMin,
        grade_max: cls.gradeMax,
        level: cls.level,
        modality: cls.modality,
        location: cls.location ?? null,
        starts_on: cls.startsOn,
        ends_on: cls.endsOn ?? null,
        description: cls.description,
        status: cls.recruitmentStatus,
        program: program?.title ?? "",
        summary: program?.summary ?? "",
        audience: program?.audience ?? "",
        outcomes: program?.outcomes ?? "",
      },
      sessions: schedules.map((s) => ({
        weekday: s.weekday,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
      })),
    };
  },
});
