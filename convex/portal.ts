import { query } from "./_generated/server";
import { v } from "convex/values";
import { iso, requireActor } from "./helpers";

export const dashboard = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const enrollments = (
      await ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", actor.id))
        .collect()
    ).filter((e) => e.status === "ACTIVE");
    let todo = 0;
    let resources = new Set<string>();
    for (const enrollment of enrollments) {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_class", (q) => q.eq("classId", enrollment.classId))
        .collect();
      for (const assignment of assignments.filter((a) => a.status === "PUBLISHED")) {
        const attempt = await ctx.db
          .query("attempts")
          .withIndex("by_assignment_student", (q) =>
            q.eq("assignmentId", assignment._id).eq("studentId", actor.id),
          )
          .unique();
        if (!attempt || attempt.status === "IN_PROGRESS") todo += 1;
      }
      const access = await ctx.db
        .query("resourceClassAccess")
        .withIndex("by_class", (q) => q.eq("classId", enrollment.classId))
        .collect();
      for (const row of access) resources.add(row.resourceId);
    }
    const done = (
      await ctx.db
        .query("attempts")
        .withIndex("by_student", (q) => q.eq("studentId", actor.id))
        .collect()
    ).filter((t) => t.status === "GRADED" || t.status === "PENDING_GRADING")
      .length;
    return {
      classes: String(enrollments.length),
      todo: String(todo),
      done: String(done),
      resources: String(resources.size),
    };
  },
});

export const myClasses = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const enrollments = (
      await ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", actor.id))
        .collect()
    ).filter((e) => e.status === "ACTIVE");
    const rows = [];
    for (const enrollment of enrollments) {
      const cls = await ctx.db.get(enrollment.classId);
      if (!cls) continue;
      const program = cls.programId ? await ctx.db.get(cls.programId) : null;
      rows.push({
        id: cls._id,
        name: cls.name,
        level: cls.level,
        modality: cls.modality,
        program: program?.title ?? "",
      });
    }
    return rows;
  },
});

export const myAssignments = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const enrollments = (
      await ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", actor.id))
        .collect()
    ).filter((e) => e.status === "ACTIVE");
    const rows = [];
    for (const enrollment of enrollments) {
      const cls = await ctx.db.get(enrollment.classId);
      const assignments = (
        await ctx.db
          .query("assignments")
          .withIndex("by_class", (q) => q.eq("classId", enrollment.classId))
          .collect()
      ).filter((a) => a.status === "PUBLISHED");
      for (const assignment of assignments) {
        const attempt = await ctx.db
          .query("attempts")
          .withIndex("by_assignment_student", (q) =>
            q.eq("assignmentId", assignment._id).eq("studentId", actor.id),
          )
          .unique();
        rows.push({
          id: assignment._id,
          title: assignment.title,
          class_name: cls?.name ?? "",
          attempt_id: attempt?._id ?? null,
          attempt_status: attempt?.status ?? null,
          due_at: iso(assignment.dueAt),
          dueAtMs: assignment.dueAt ?? Number.POSITIVE_INFINITY,
        });
      }
    }
    rows.sort((a, b) => a.dueAtMs - b.dueAtMs);
    return rows.map(({ dueAtMs: _, ...row }) => row);
  },
});

export const myResources = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const enrollments = (
      await ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", actor.id))
        .collect()
    ).filter((e) => e.status === "ACTIVE");
    const seen = new Set<string>();
    const rows = [];
    for (const enrollment of enrollments) {
      const access = await ctx.db
        .query("resourceClassAccess")
        .withIndex("by_class", (q) => q.eq("classId", enrollment.classId))
        .collect();
      for (const row of access) {
        if (seen.has(row.resourceId)) continue;
        seen.add(row.resourceId);
        const resource = await ctx.db.get(row.resourceId);
        if (!resource) continue;
        rows.push({
          id: resource._id,
          title: resource.title,
          description: resource.description,
          mime_type: resource.mimeType,
        });
      }
    }
    rows.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    return rows;
  },
});

export const attemptPage = query({
  args: { tokenHash: v.string(), attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== actor.id) return null;
    const assignment = await ctx.db.get(attempt.assignmentId);
    if (!assignment || assignment.status !== "PUBLISHED") return null;
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    questions.sort((a, b) => a.position - b.position);
    return {
      attempt: {
        title: assignment.title,
        answers: (attempt.answers ?? {}) as Record<string, string>,
        status: attempt.status,
        mode: assignment.mode,
      },
      questions: questions.map((q) => ({
        id: q._id,
        type: q.type,
        prompt: q.prompt,
        options: q.options ?? null,
        points: String(q.points),
      })),
    };
  },
});

export const resultPage = query({
  args: { tokenHash: v.string(), attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const attempt = await ctx.db.get(args.attemptId);
    if (
      !attempt ||
      attempt.studentId !== actor.id ||
      attempt.status === "IN_PROGRESS"
    )
      return null;
    const assignment = await ctx.db.get(attempt.assignmentId);
    if (!assignment) return null;
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    questions.sort((a, b) => a.position - b.position);
    const total = questions.reduce((sum, q) => sum + q.points, 0);
    return {
      assignment_id: assignment._id,
      title: assignment.title,
      score: attempt.score == null ? null : String(attempt.score),
      status: attempt.status,
      answers: (attempt.answers ?? {}) as Record<string, string>,
      teacher_feedback: attempt.teacherFeedback ?? null,
      total: String(total),
      questions: questions.map((q) => ({
        id: q._id,
        prompt: q.prompt,
        type: q.type,
        correct_answer: q.correctAnswer ?? null,
        explanation: q.explanation ?? null,
        points: String(q.points),
        position: q.position,
      })),
    };
  },
});

export const myTasks = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const rank: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 1,
      DONE: 2,
      CANCELLED: 3,
    };
    const tasks = (
      await ctx.db
        .query("workTasks")
        .withIndex("by_assignee", (q) => q.eq("assignedTo", actor.id))
        .collect()
    )
      .filter((t) => t.tenantId === actor.tenantId)
      .sort(
        (a, b) =>
          (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
          (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
      );
    const rows = [];
    for (const task of tasks) {
      const creator = await ctx.db.get(task.createdBy);
      rows.push({
        id: task._id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_at: iso(task.dueAt),
        creator: creator?.name ?? "",
      });
    }
    return rows;
  },
});

export const ieltsLearning = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const tracks = await ctx.db
      .query("learningTracks")
      .withIndex("by_tenant_slug", (q) =>
        q.eq("tenantId", actor.tenantId).eq("slug", "ielts"),
      )
      .collect();
    const track = tracks.find((t) => t.status === "PUBLISHED");
    if (!track) return { track: null, modules: [] };
    const modules = (
      await ctx.db
        .query("learningModules")
        .withIndex("by_track", (q) => q.eq("trackId", track._id))
        .collect()
    )
      .filter((m) => m.isPublished)
      .sort((a, b) => a.position - b.position);
    const rows = [];
    for (const module of modules) {
      const units = (
        await ctx.db
          .query("learningUnits")
          .withIndex("by_module", (q) => q.eq("moduleId", module._id))
          .collect()
      ).filter((u) => u.isPublished);
      let completed = 0;
      for (const unit of units) {
        const progress = await ctx.db
          .query("studentUnitProgress")
          .withIndex("by_student_unit", (q) =>
            q.eq("studentId", actor.id).eq("unitId", unit._id),
          )
          .unique();
        if (progress?.status === "COMPLETED") completed += 1;
      }
      rows.push({
        id: module._id,
        slug: module.slug,
        title: module.title,
        skill: module.skill,
        summary: module.summary,
        accent: module.accent,
        unit_count: units.length,
        completed_count: completed,
      });
    }
    return {
      track: {
        id: track._id,
        title: track.title,
        summary: track.summary,
        target: track.target,
      },
      modules: rows,
    };
  },
});

export const checkAnswer = query({
  args: {
    tokenHash: v.string(),
    attemptId: v.id("attempts"),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== actor.id || attempt.status !== "IN_PROGRESS")
      return null;
    const assignment = await ctx.db.get(attempt.assignmentId);
    const question = await ctx.db.get(args.questionId);
    if (!assignment || !question || question.assignmentId !== assignment._id)
      return null;
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", assignment.classId).eq("studentId", actor.id),
      )
      .unique();
    if (enrollment?.status !== "ACTIVE") return null;
    return {
      type: question.type,
      correct_answer: question.correctAnswer ?? null,
      explanation: question.explanation ?? null,
      mode: assignment.mode,
    };
  },
});
