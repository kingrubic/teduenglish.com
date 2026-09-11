import { query } from "./_generated/server";
import { v } from "convex/values";
import { iso, requireActor, classAccess, sessionLabel } from "./helpers";
import type { Id } from "./_generated/dataModel";

export const dashboard = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const classes = (await ctx.db.query("classes").collect()).filter(
      (c) => c.tenantId === actor.tenantId,
    );
    const users = (await ctx.db.query("users").collect()).filter(
      (u) =>
        u.tenantId === actor.tenantId &&
        u.role === "USER" &&
        u.status === "ACTIVE",
    );
    const assignments = (
      await ctx.db
        .query("assignments")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    );
    let pending = 0;
    for (const assignment of assignments) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
        .collect();
      pending += attempts.filter((t) => t.status === "PENDING_GRADING").length;
    }
    const inquiries = (
      await ctx.db
        .query("enrollmentInquiries")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    ).filter((i) => i.status === "NEW");
    return {
      classes: String(classes.length),
      students: String(users.length),
      pending: String(pending),
      inquiries: String(inquiries.length),
    };
  },
});

export const classOptions = query({
  args: { tokenHash: v.string(), excludeClosed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const classes = (
      await ctx.db
        .query("classes")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    ).filter(
      (c) =>
        (!args.excludeClosed || c.recruitmentStatus !== "CLOSED") &&
        (actor.role === "ADMIN" ||
          actor.role === "MOD" ||
          c.teacherId === actor.id),
    );
    classes.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return classes.map((c) => ({ id: c._id, name: c.name }));
  },
});

export const programOptions = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const programs = await ctx.db
      .query("programs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    programs.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    return programs.map((p) => ({ id: p._id, title: p.title }));
  },
});

export const classList = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const classes = await ctx.db
      .query("classes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    classes.sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const cls of classes) {
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
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
        level: cls.level,
        modality: cls.modality,
        status: cls.recruitmentStatus,
        students: String(enrollments.filter((e) => e.status === "ACTIVE").length),
        sessions:
          schedules.map((s) => sessionLabel(s.weekday, s.startsAt)).join(", ") ||
          "Chưa có lịch",
      });
    }
    return result;
  },
});

export const classManage = query({
  args: { tokenHash: v.string(), id: v.id("classes") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const cls = await classAccess(ctx, actor, args.id);
    if (!cls) return null;
    const sessions = await ctx.db
      .query("classSchedules")
      .withIndex("by_class", (q) => q.eq("classId", cls._id))
      .collect();
    sessions.sort((a, b) => a.weekday - b.weekday);
    const exceptions = await ctx.db
      .query("scheduleExceptions")
      .withIndex("by_class", (q) => q.eq("classId", cls._id))
      .collect();
    exceptions.sort((a, b) => b.exceptionDate.localeCompare(a.exceptionDate));
    return {
      name: cls.name,
      code: cls.code,
      sessions: sessions.map((s) => ({
        id: s._id,
        weekday: s.weekday,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
      })),
      exceptions: exceptions.map((e) => ({
        id: e._id,
        exception_date: e.exceptionDate,
        type: e.type,
        note: e.note,
      })),
    };
  },
});

export const studentsPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const students = (
      await ctx.db
        .query("users")
        .withIndex("by_tenant_role", (q) =>
          q.eq("tenantId", actor.tenantId).eq("role", "USER"),
        )
        .collect()
    )
      .filter((u) => !u.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((u) => ({ id: u._id, name: u.name, email: u.email }));
    const classes = (
      await ctx.db
        .query("classes")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    ).filter(
      (c) =>
        actor.role === "ADMIN" ||
        actor.role === "MOD" ||
        c.teacherId === actor.id,
    );
    const enrollments = [];
    for (const cls of classes) {
      const rows = await ctx.db
        .query("enrollments")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      for (const row of rows.filter((e) => e.status === "ACTIVE")) {
        enrollments.push({
          student_id: row.studentId,
          class_id: row.classId,
          class_name: cls.name,
        });
      }
    }
    return {
      students,
      classes: classes
        .sort((a, b) => a.name.localeCompare(b.name, "vi"))
        .map((c) => ({ id: c._id, name: c.name })),
      enrollments,
    };
  },
});

export const resourcesPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const items = (
      await ctx.db
        .query("resources")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        id: r._id,
        title: r.title,
        description: r.description,
        mime_type: r.mimeType,
        original_name: r.originalName ?? null,
        byte_size: r.byteSize == null ? null : String(r.byteSize),
      }));
    return { items };
  },
});

export const assignmentList = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    assignments.sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const assignment of assignments) {
      const cls = await ctx.db.get(assignment.classId);
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
        .collect();
      result.push({
        id: assignment._id,
        title: assignment.title,
        class_name: cls?.name ?? "",
        status: assignment.status,
        mode: assignment.mode,
        submissions: String(
          attempts.filter((t) => t.status !== "IN_PROGRESS").length,
        ),
      });
    }
    return result;
  },
});

export const assignmentDetail = query({
  args: { tokenHash: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const assignment = await ctx.db.get(args.id);
    if (
      !assignment ||
      assignment.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || assignment.createdBy === actor.id)
    )
      return null;
    const cls = await ctx.db.get(assignment.classId);
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    questions.sort((a, b) => a.position - b.position);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    const attemptRows = [];
    for (const attempt of attempts) {
      const student = await ctx.db.get(attempt.studentId);
      attemptRows.push({
        id: attempt._id,
        student: student?.name ?? "",
        status: attempt.status,
        score: attempt.score == null ? null : String(attempt.score),
        submitted_at: iso(attempt.submittedAt),
        manual_max: String(
          questions
            .filter((q) => q.type === "SHORT_ANSWER")
            .reduce((sum, q) => sum + q.points, 0),
        ),
        answers: (attempt.answers ?? {}) as Record<string, string>,
      });
    }
    attemptRows.sort((a, b) => a.student.localeCompare(b.student, "vi"));
    return {
      assignment: {
        title: assignment.title,
        instructions: assignment.instructions,
        status: assignment.status,
        mode: assignment.mode,
        class_name: cls?.name ?? "",
        due_at: iso(assignment.dueAt),
      },
      attempts: attemptRows,
      shortQuestions: questions
        .filter((q) => q.type === "SHORT_ANSWER")
        .map((q) => ({ id: q._id, prompt: q.prompt })),
    };
  },
});

export const questionBankPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const items = (
      await ctx.db
        .query("questionBankItems")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .filter((item) => !item.archivedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
      .map((item) => ({
        id: item._id,
        type: item.type,
        prompt: item.prompt,
        points: String(item.points),
        source_filename: item.sourceFilename ?? null,
      }));
    return { items };
  },
});

export const usersPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const users = (
      await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .filter((u) => !u.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const user of users) {
      const dept = user.departmentId
        ? await ctx.db.get(user.departmentId)
        : null;
      const links = await ctx.db
        .query("userPermissionGroups")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const names = [];
      for (const link of links) {
        const group = await ctx.db.get(link.groupId);
        if (group) names.push(group.name);
      }
      result.push({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        department: dept?.name ?? null,
        groups: names.length ? names.join(", ") : null,
      });
    }
    const departments = (
      await ctx.db
        .query("departments")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .filter((d) => d.status === "ACTIVE")
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((d) => ({ id: d._id, name: d.name }));
    const groups = (
      await ctx.db
        .query("permissionGroups")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .filter((g) => g.status === "ACTIVE")
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((g) => ({ id: g._id, name: g.name }));
    return { users: result, departments, groups };
  },
});

export const inquiries = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    return (
      await ctx.db
        .query("enrollmentInquiries")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map((row) => ({
        id: row._id,
        full_name: row.fullName,
        phone: row.phone,
        current_level: row.currentLevel,
        status: row.status,
      }));
  },
});

export const departmentsPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    departments.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    return departments.map((d) => ({
      id: d._id,
      name: d.name,
      description: d.description,
      status: d.status,
      members: String(
        users.filter((u) => u.departmentId === d._id && !u.deletedAt).length,
      ),
    }));
  },
});

export const permissionGroupsPage = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const groups = await ctx.db
      .query("permissionGroups")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .collect();
    groups.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const result = [];
    for (const group of groups) {
      const menus = await ctx.db
        .query("permissionGroupMenus")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      const members = await ctx.db
        .query("userPermissionGroups")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      result.push({
        id: group._id,
        name: group.name,
        description: group.description,
        menus: menus.map((m) => m.menuKey).join(", "),
        members: String(members.length),
      });
    }
    return result;
  },
});

export const tasksPage = query({
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
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    ).sort(
      (a, b) =>
        (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
        (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
        b.createdAt - a.createdAt,
    );
    const rows = [];
    for (const task of tasks) {
      const assignee = await ctx.db.get(task.assignedTo);
      const creator = await ctx.db.get(task.createdBy);
      rows.push({
        id: task._id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_at: iso(task.dueAt),
        assignee: assignee?.name ?? "",
        creator: creator?.name ?? "",
      });
    }
    const users = (
      await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
        .collect()
    )
      .filter((u) => u.status === "ACTIVE" && !u.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((u) => ({ id: u._id, name: u.name, role: u.role }));
    return { tasks: rows, users };
  },
});

export const ieltsCms = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const tracks = await ctx.db
      .query("learningTracks")
      .withIndex("by_tenant_slug", (q) =>
        q.eq("tenantId", actor.tenantId).eq("slug", "ielts"),
      )
      .collect();
    const track = tracks[0];
    if (!track) return { track: null, modules: [] };
    const modules = await ctx.db
      .query("learningModules")
      .withIndex("by_track", (q) => q.eq("trackId", track._id))
      .collect();
    modules.sort((a, b) => a.position - b.position);
    const rows = [];
    for (const module of modules) {
      const units = await ctx.db
        .query("learningUnits")
        .withIndex("by_module", (q) => q.eq("moduleId", module._id))
        .collect();
      rows.push({
        id: module._id,
        title: module.title,
        skill: module.skill,
        summary: module.summary,
        accent: module.accent,
        unit_count: units.length,
        published_count: units.filter((u) => u.isPublished).length,
      });
    }
    return {
      track: {
        id: track._id,
        title: track.title,
        summary: track.summary,
        target: track.target,
        status: track.status,
      },
      modules: rows,
    };
  },
});

export const resourceDownload = query({
  args: { tokenHash: v.string(), id: v.id("resources") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const resource = await ctx.db.get(args.id);
    if (!resource || resource.tenantId !== actor.tenantId) return null;
    if (actor.role !== "ADMIN" && actor.role !== "MOD") {
      const access = await ctx.db
        .query("resourceClassAccess")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .collect();
      let allowed = false;
      for (const row of access) {
        const enrollment = await ctx.db
          .query("enrollments")
          .withIndex("by_class_student", (q) =>
            q.eq("classId", row.classId).eq("studentId", actor.id),
          )
          .unique();
        if (enrollment?.status === "ACTIVE") {
          allowed = true;
          break;
        }
      }
      if (!allowed) return null;
    }
    if (!resource.storageId) return null;
    const url = await ctx.storage.getUrl(resource.storageId);
    if (!url) return null;
    return {
      url,
      mime_type: resource.mimeType,
      original_name: resource.originalName ?? "tai-lieu",
    };
  },
});

export const passwordHash = query({
  args: { tokenHash: v.string(), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const id = (args.userId ?? actor.id) as Id<"users">;
    if (args.userId && actor.role !== "ADMIN" && args.userId !== actor.id)
      throw new Error("Forbidden");
    const user = await ctx.db.get(id);
    return user?.passwordHash ?? null;
  },
});
