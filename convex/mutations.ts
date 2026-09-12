import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  audit,
  classAccess,
  ensureAttemptsForClass,
  learnerGroupId,
  requireActor,
} from "./helpers";

const questionType = v.union(
  v.literal("SINGLE_CHOICE"),
  v.literal("TRUE_FALSE"),
  v.literal("SHORT_ANSWER"),
);

export const updateSiteSettings = mutation({
  args: {
    tokenHash: v.string(),
    brandName: v.string(),
    tagline: v.string(),
    teacherName: v.string(),
    teacherTitle: v.string(),
    teacherOrganization: v.string(),
    teacherShortBio: v.string(),
    teacherLongBio: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    seoTitle: v.string(),
    seoDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const settings = await ctx.db
      .query("siteSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", actor.tenantId))
      .unique();
    if (!settings) throw new Error("Site settings missing");
    const { tokenHash: _, ...patch } = args;
    await ctx.db.patch(settings._id, { ...patch, updatedAt: Date.now() });
    await audit(ctx, actor, "UPDATE", "SITE_SETTINGS", actor.tenantId);
  },
});

export const submitInquiry = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    programId: v.optional(v.id("programs")),
    currentLevel: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.query("tenants").first();
    if (!tenant) throw new Error("Tenant missing");
    await ctx.db.insert("enrollmentInquiries", {
      tenantId: tenant._id,
      fullName: args.fullName,
      phone: args.phone,
      email: args.email,
      programId: args.programId,
      currentLevel: args.currentLevel,
      note: args.note,
      status: "NEW",
      createdAt: Date.now(),
    });
  },
});

export const createClass = mutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    code: v.string(),
    gradeMin: v.number(),
    gradeMax: v.number(),
    level: v.string(),
    modality: v.string(),
    location: v.optional(v.string()),
    startsOn: v.string(),
    programId: v.id("programs"),
    status: v.union(
      v.literal("RECRUITING"),
      v.literal("UPCOMING"),
      v.literal("FULL"),
      v.literal("CLOSED"),
    ),
    capacity: v.optional(v.number()),
    sessions: v.array(
      v.object({ weekday: v.number(), start: v.string(), end: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const classId = await ctx.db.insert("classes", {
      tenantId: actor.tenantId,
      programId: args.programId,
      teacherId: actor.id,
      name: args.name,
      code: args.code.toUpperCase(),
      gradeMin: args.gradeMin,
      gradeMax: args.gradeMax,
      level: args.level,
      modality: args.modality,
      location: args.location,
      startsOn: args.startsOn,
      recruiting: args.status === "RECRUITING",
      recruitmentStatus: args.status,
      capacity: args.capacity,
      publicRemainingSeats: false,
      description: "Lớp được tạo trong CMS.",
      isDemo: false,
      createdAt: Date.now(),
    });
    for (const session of args.sessions) {
      await ctx.db.insert("classSchedules", {
        classId,
        weekday: session.weekday,
        startsAt: session.start,
        endsAt: session.end,
        timezone: "Asia/Ho_Chi_Minh",
        effectiveFrom: args.startsOn,
      });
    }
    await audit(ctx, actor, "CREATE", "CLASS", classId);
    return classId;
  },
});

export const addScheduleException = mutation({
  args: {
    tokenHash: v.string(),
    classId: v.id("classes"),
    date: v.string(),
    type: v.union(
      v.literal("CANCELLED"),
      v.literal("MAKEUP"),
      v.literal("TIME_CHANGE"),
      v.literal("LOCATION_CHANGE"),
    ),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const cls = await classAccess(ctx, actor, args.classId);
    if (!cls) throw new Error("Không có quyền cập nhật lớp");
    await ctx.db.insert("scheduleExceptions", {
      classId: args.classId,
      exceptionDate: args.date,
      type: args.type,
      startsAt: args.start,
      endsAt: args.end,
      location: args.location,
      note: args.note ?? "",
      createdAt: Date.now(),
    });
  },
});

export const createAssignment = mutation({
  args: {
    tokenHash: v.string(),
    classId: v.id("classes"),
    title: v.string(),
    instructions: v.string(),
    mode: v.union(v.literal("PRACTICE"), v.literal("EXAM")),
    prompt: v.string(),
    optionA: v.string(),
    optionB: v.string(),
    correct: v.string(),
    explanation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const cls = await classAccess(ctx, actor, args.classId);
    if (!cls) throw new Error("Không có quyền giao bài cho lớp này");
    const now = Date.now();
    const assignmentId = await ctx.db.insert("assignments", {
      tenantId: actor.tenantId,
      classId: args.classId,
      createdBy: actor.id,
      title: args.title,
      instructions: args.instructions,
      status: "PUBLISHED",
      maxAttempts: 1,
      mode: args.mode,
      publishedAt: now,
      shuffleQuestions: false,
      shuffleOptions: false,
      createdAt: now,
    });
    await ctx.db.insert("questions", {
      assignmentId,
      type: "SINGLE_CHOICE",
      prompt: args.prompt,
      options: [args.optionA, args.optionB],
      correctAnswer: args.correct,
      explanation: args.explanation,
      points: 1,
      position: 1,
    });
    await ensureAttemptsForClass(ctx, assignmentId, args.classId);
    await audit(ctx, actor, "CREATE_AND_ASSIGN", "ASSIGNMENT", assignmentId);
    return assignmentId;
  },
});

export const importQuestionBank = mutation({
  args: {
    tokenHash: v.string(),
    sourceFilename: v.string(),
    questions: v.array(
      v.object({
        type: questionType,
        prompt: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        explanation: v.optional(v.string()),
        points: v.number(),
        tags: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    for (const q of args.questions) {
      await ctx.db.insert("questionBankItems", {
        tenantId: actor.tenantId,
        createdBy: actor.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
        tags: q.tags,
        sourceFilename: args.sourceFilename,
        createdAt: Date.now(),
      });
    }
    await audit(ctx, actor, "IMPORT", "QUESTION_BANK", undefined, {
      file: args.sourceFilename,
      count: args.questions.length,
    });
    return args.questions.length;
  },
});

export const createAssignmentFromBank = mutation({
  args: {
    tokenHash: v.string(),
    classId: v.id("classes"),
    title: v.string(),
    instructions: v.string(),
    dueAt: v.optional(v.number()),
    mode: v.union(v.literal("PRACTICE"), v.literal("EXAM")),
    questionIds: v.array(v.id("questionBankItems")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const cls = await classAccess(ctx, actor, args.classId);
    if (!cls) throw new Error("Không có quyền giao bài cho lớp này");
    const items = [];
    for (const id of args.questionIds) {
      const item = await ctx.db.get(id);
      if (!item || item.tenantId !== actor.tenantId || item.archivedAt)
        throw new Error("Một số câu hỏi không còn tồn tại");
      items.push(item);
    }
    const now = Date.now();
    const assignmentId = await ctx.db.insert("assignments", {
      tenantId: actor.tenantId,
      classId: args.classId,
      createdBy: actor.id,
      title: args.title,
      instructions: args.instructions,
      dueAt: args.dueAt,
      status: "PUBLISHED",
      maxAttempts: 1,
      mode: args.mode,
      publishedAt: now,
      shuffleQuestions: false,
      shuffleOptions: false,
      createdAt: now,
    });
    for (const [position, item] of items.entries()) {
      await ctx.db.insert("questions", {
        assignmentId,
        type: item.type,
        prompt: item.prompt,
        options: item.options,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation,
        points: item.points,
        position: position + 1,
      });
    }
    await ensureAttemptsForClass(ctx, assignmentId, args.classId);
    await audit(ctx, actor, "CREATE_FROM_BANK", "ASSIGNMENT", assignmentId, {
      questionCount: items.length,
    });
    return assignmentId;
  },
});

export const saveAnswers = mutation({
  args: {
    tokenHash: v.string(),
    attemptId: v.id("attempts"),
    answers: v.any(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["USER"]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== actor.id || attempt.status !== "IN_PROGRESS")
      throw new Error("Không thể lưu bài làm");
    await ctx.db.patch(attempt._id, { answers: args.answers, savedAt: Date.now() });
  },
});

export const submitAttempt = mutation({
  args: {
    tokenHash: v.string(),
    attemptId: v.id("attempts"),
    answers: v.any(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["USER"]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== actor.id || attempt.status !== "IN_PROGRESS")
      throw new Error("Bài làm đã nộp hoặc không tồn tại");
    const assignment = await ctx.db.get(attempt.assignmentId);
    if (
      !assignment ||
      assignment.status !== "PUBLISHED" ||
      (assignment.dueAt != null && assignment.dueAt < Date.now())
    )
      throw new Error("Bài làm đã nộp hoặc không tồn tại");
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    let score = 0;
    let manual = false;
    const answers = (args.answers ?? {}) as Record<string, string>;
    for (const q of questions) {
      if (q.type === "SHORT_ANSWER") manual = true;
      else if (String(answers[q._id] ?? "") === String(q.correctAnswer ?? ""))
        score += q.points;
    }
    const status = manual ? "PENDING_GRADING" : "GRADED";
    const now = Date.now();
    await ctx.db.patch(attempt._id, {
      answers,
      score,
      status,
      submittedAt: now,
      savedAt: now,
      gradedAt: status === "GRADED" ? now : undefined,
    });
    await audit(ctx, actor, "SUBMIT", "ATTEMPT", attempt._id);
  },
});

export const updateAssignmentStatus = mutation({
  args: {
    tokenHash: v.string(),
    assignmentId: v.id("assignments"),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("PUBLISHED"),
      v.literal("ARCHIVED"),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const assignment = await ctx.db.get(args.assignmentId);
    if (
      !assignment ||
      assignment.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || assignment.createdBy === actor.id)
    )
      throw new Error("Không tìm thấy bài tập");
    const now = Date.now();
    await ctx.db.patch(assignment._id, {
      status: args.status,
      publishedAt:
        args.status === "PUBLISHED"
          ? (assignment.publishedAt ?? now)
          : assignment.publishedAt,
      closedAt: args.status === "ARCHIVED" ? now : undefined,
    });
    if (args.status === "PUBLISHED")
      await ensureAttemptsForClass(ctx, assignment._id, assignment.classId);
  },
});

export const updateAssignmentDetails = mutation({
  args: {
    tokenHash: v.string(),
    assignmentId: v.id("assignments"),
    title: v.string(),
    instructions: v.string(),
    dueAt: v.optional(v.number()),
    mode: v.union(v.literal("PRACTICE"), v.literal("EXAM")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const assignment = await ctx.db.get(args.assignmentId);
    if (
      !assignment ||
      assignment.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || assignment.createdBy === actor.id)
    )
      throw new Error("Không tìm thấy bài tập");
    await ctx.db.patch(assignment._id, {
      title: args.title,
      instructions: args.instructions,
      dueAt: args.dueAt,
      mode: args.mode,
    });
  },
});

export const duplicateAssignment = mutation({
  args: { tokenHash: v.string(), assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const source = await ctx.db.get(args.assignmentId);
    if (
      !source ||
      source.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || source.createdBy === actor.id)
    )
      throw new Error("Không tìm thấy bài tập");
    const copyId = await ctx.db.insert("assignments", {
      tenantId: source.tenantId,
      classId: source.classId,
      createdBy: actor.id,
      title: `${source.title} · Bản sao`,
      instructions: source.instructions,
      status: "DRAFT",
      maxAttempts: source.maxAttempts,
      mode: source.mode,
      shuffleQuestions: source.shuffleQuestions,
      shuffleOptions: source.shuffleOptions,
      createdAt: Date.now(),
    });
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", source._id))
      .collect();
    for (const q of questions) {
      await ctx.db.insert("questions", {
        assignmentId: copyId,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
        position: q.position,
      });
    }
    return copyId;
  },
});

export const gradeAttempt = mutation({
  args: {
    tokenHash: v.string(),
    attemptId: v.id("attempts"),
    manualScore: v.number(),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw new Error("Không tìm thấy bài nộp");
    const assignment = await ctx.db.get(attempt.assignmentId);
    if (
      !assignment ||
      assignment.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || assignment.createdBy === actor.id)
    )
      throw new Error("Không tìm thấy bài nộp");
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .collect();
    const answers = (attempt.answers ?? {}) as Record<string, string>;
    let auto = 0;
    let manualMax = 0;
    for (const q of questions) {
      if (q.type === "SHORT_ANSWER") manualMax += q.points;
      else if (String(answers[q._id] ?? "") === String(q.correctAnswer ?? ""))
        auto += q.points;
    }
    if (args.manualScore > manualMax)
      throw new Error("Điểm tự luận vượt quá điểm tối đa");
    await ctx.db.patch(attempt._id, {
      score: auto + args.manualScore,
      status: "GRADED",
      teacherFeedback: args.feedback,
      gradedAt: Date.now(),
    });
  },
});

export const createDepartment = mutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const id = await ctx.db.insert("departments", {
      tenantId: actor.tenantId,
      name: args.name,
      description: args.description ?? "",
      status: "ACTIVE",
      createdAt: Date.now(),
    });
    await audit(ctx, actor, "CREATE", "DEPARTMENT", id);
  },
});

export const createPermissionGroup = mutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    menuKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const now = Date.now();
    const id = await ctx.db.insert("permissionGroups", {
      tenantId: actor.tenantId,
      name: args.name,
      description: args.description ?? "",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    for (const key of args.menuKeys) {
      await ctx.db.insert("permissionGroupMenus", { groupId: id, menuKey: key });
    }
    await audit(ctx, actor, "CREATE", "PERMISSION_GROUP", id, {
      menuKeys: args.menuKeys,
    });
  },
});

export const createUser = mutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("ADMIN"), v.literal("MOD"), v.literal("USER")),
    departmentId: v.optional(v.id("departments")),
    groupIds: v.array(v.id("permissionGroups")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const userId = await ctx.db.insert("users", {
      tenantId: actor.tenantId,
      email: args.email.toLowerCase(),
      passwordHash: args.passwordHash,
      name: args.name,
      role: args.role,
      status: "ACTIVE",
      departmentId: args.departmentId,
      mustChangePassword: true,
      createdAt: Date.now(),
    });
    if (args.role === "USER") {
      let groupIds = args.groupIds;
      if (!groupIds.length) {
        const learner = await learnerGroupId(ctx, actor.tenantId);
        if (learner) groupIds = [learner];
      }
      for (const groupId of groupIds) {
        const group = await ctx.db.get(groupId);
        if (!group || group.tenantId !== actor.tenantId) continue;
        await ctx.db.insert("userPermissionGroups", { userId, groupId });
      }
    }
    await audit(ctx, actor, "CREATE", "USER", userId);
    return userId;
  },
});

export const updateUserStatus = mutation({
  args: {
    tokenHash: v.string(),
    userId: v.id("users"),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("SUSPENDED"),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    if (args.userId === actor.id && args.status !== "ACTIVE")
      throw new Error("Không thể tự khóa tài khoản đang đăng nhập");
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== actor.tenantId || user.deletedAt)
      throw new Error("Không tìm thấy tài khoản");
    await ctx.db.patch(user._id, { status: args.status });
    if (args.status !== "ACTIVE") {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of sessions) await ctx.db.delete(session._id);
    }
  },
});

export const adminResetPassword = mutation({
  args: {
    tokenHash: v.string(),
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN"]);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== actor.tenantId || user.deletedAt)
      throw new Error("Không tìm thấy tài khoản");
    await ctx.db.patch(user._id, {
      passwordHash: args.passwordHash,
      mustChangePassword: true,
    });
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await audit(ctx, actor, "RESET_PASSWORD", "USER", user._id);
    return { name: user.name, email: user.email };
  },
});

export const changePassword = mutation({
  args: { tokenHash: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, undefined, {
      allowMustChangePassword: true,
    });
    await ctx.db.patch(actor.id, {
      passwordHash: args.passwordHash,
      mustChangePassword: false,
    });
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", actor.id))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
  },
});

export const enrollStudent = mutation({
  args: {
    tokenHash: v.string(),
    studentId: v.id("users"),
    classId: v.id("classes"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const cls = await classAccess(ctx, actor, args.classId);
    const student = await ctx.db.get(args.studentId);
    if (!cls || !student || student.tenantId !== cls.tenantId || student.role !== "USER")
      throw new Error("Học sinh hoặc lớp không hợp lệ");
    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.classId).eq("studentId", args.studentId),
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, { status: "ACTIVE" });
    else
      await ctx.db.insert("enrollments", {
        classId: args.classId,
        studentId: args.studentId,
        status: "ACTIVE",
        enrolledAt: Date.now(),
      });
    const assignments = (
      await ctx.db
        .query("assignments")
        .withIndex("by_class", (q) => q.eq("classId", args.classId))
        .collect()
    ).filter((a) => a.status === "PUBLISHED");
    const now = Date.now();
    for (const assignment of assignments) {
      const attempt = await ctx.db
        .query("attempts")
        .withIndex("by_assignment_student", (q) =>
          q.eq("assignmentId", assignment._id).eq("studentId", args.studentId),
        )
        .unique();
      if (!attempt)
        await ctx.db.insert("attempts", {
          assignmentId: assignment._id,
          studentId: args.studentId,
          attemptNo: 1,
          status: "IN_PROGRESS",
          answers: {},
          startedAt: now,
          savedAt: now,
        });
    }
  },
});

export const unenrollStudent = mutation({
  args: {
    tokenHash: v.string(),
    studentId: v.id("users"),
    classId: v.id("classes"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const cls = await classAccess(ctx, actor, args.classId);
    if (!cls) throw new Error("Không tìm thấy enrollment");
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.classId).eq("studentId", args.studentId),
      )
      .unique();
    if (!enrollment) throw new Error("Không tìm thấy enrollment");
    await ctx.db.patch(enrollment._id, { status: "INACTIVE" });
  },
});

export const generateUploadUrl = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    return ctx.storage.generateUploadUrl();
  },
});

export const createResource = mutation({
  args: {
    tokenHash: v.string(),
    title: v.string(),
    description: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    originalName: v.string(),
    byteSize: v.number(),
    classIds: v.array(v.id("classes")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const resourceId = await ctx.db.insert("resources", {
      tenantId: actor.tenantId,
      title: args.title,
      description: args.description,
      mimeType: args.mimeType,
      storageId: args.storageId,
      originalName: args.originalName,
      byteSize: args.byteSize,
      createdBy: actor.id,
      createdAt: Date.now(),
    });
    for (const classId of args.classIds) {
      const cls = await classAccess(ctx, actor, classId);
      if (cls)
        await ctx.db.insert("resourceClassAccess", { resourceId, classId });
    }
    return resourceId;
  },
});

export const createWorkTask = mutation({
  args: {
    tokenHash: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.id("users"),
    priority: v.union(
      v.literal("LOW"),
      v.literal("MEDIUM"),
      v.literal("HIGH"),
      v.literal("URGENT"),
    ),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash, ["ADMIN", "MOD"]);
    const assignee = await ctx.db.get(args.assignedTo);
    if (
      !assignee ||
      assignee.tenantId !== actor.tenantId ||
      assignee.status !== "ACTIVE" ||
      assignee.deletedAt
    )
      throw new Error("Người nhận không hợp lệ");
    const id = await ctx.db.insert("workTasks", {
      tenantId: actor.tenantId,
      title: args.title,
      description: args.description ?? "",
      priority: args.priority,
      status: "TODO",
      dueAt: args.dueAt,
      createdBy: actor.id,
      assignedTo: args.assignedTo,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await audit(ctx, actor, "ASSIGN", "WORK_TASK", id);
    return id;
  },
});

export const updateWorkTaskStatus = mutation({
  args: {
    tokenHash: v.string(),
    taskId: v.id("workTasks"),
    status: v.union(
      v.literal("TODO"),
      v.literal("IN_PROGRESS"),
      v.literal("DONE"),
      v.literal("CANCELLED"),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.tokenHash);
    const task = await ctx.db.get(args.taskId);
    if (
      !task ||
      task.tenantId !== actor.tenantId ||
      !(actor.role === "ADMIN" || actor.role === "MOD" || task.assignedTo === actor.id)
    )
      throw new Error("Không có quyền cập nhật công việc");
    await ctx.db.patch(task._id, { status: args.status, updatedAt: Date.now() });
  },
});
