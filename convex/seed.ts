import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  DEFAULT_SITE,
  IELTS_MODULES,
  LEARNER_MENUS,
} from "./helpers";

export const seedDev = mutation({
  args: { passwordHash: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("tenants").first();
    if (existing) return { tenantId: existing._id, seeded: false };

    const now = Date.now();
    const tenantId = await ctx.db.insert("tenants", {
      name: "English Learning Hub Development",
      createdAt: now,
    });

    const teacherId = await ctx.db.insert("users", {
      tenantId,
      email: "teacher@example.test",
      passwordHash: args.passwordHash,
      name: "Giáo viên Demo",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: now,
    });
    await ctx.db.insert("users", {
      tenantId,
      email: "mod@example.test",
      passwordHash: args.passwordHash,
      name: "Điều phối viên Demo",
      role: "MOD",
      status: "ACTIVE",
      createdAt: now,
    });
    const studentId = await ctx.db.insert("users", {
      tenantId,
      email: "student@example.test",
      passwordHash: args.passwordHash,
      name: "Học sinh Demo",
      role: "USER",
      status: "ACTIVE",
      createdAt: now,
    });
    await ctx.db.insert("users", {
      tenantId,
      email: "outsider@example.test",
      passwordHash: args.passwordHash,
      name: "Học sinh Ngoài lớp",
      role: "USER",
      status: "ACTIVE",
      createdAt: now,
    });

    const groupId = await ctx.db.insert("permissionGroups", {
      tenantId,
      name: "Học viên",
      description: "Quyền mặc định cho người học",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    for (const menuKey of LEARNER_MENUS) {
      await ctx.db.insert("permissionGroupMenus", { groupId, menuKey });
    }
    const learners = await ctx.db
      .query("users")
      .withIndex("by_tenant_role", (q) =>
        q.eq("tenantId", tenantId).eq("role", "USER"),
      )
      .collect();
    for (const learner of learners) {
      await ctx.db.insert("userPermissionGroups", {
        userId: learner._id,
        groupId,
      });
    }

    await ctx.db.insert("siteSettings", {
      tenantId,
      ...DEFAULT_SITE,
      updatedAt: now,
    });

    const programId = await ctx.db.insert("programs", {
      tenantId,
      slug: "english-foundation",
      title: "English Foundation",
      summary:
        "Củng cố nền tảng từ vựng, ngữ pháp và giao tiếp theo lộ trình có đo lường.",
      audience: "Người học trình độ A1–A2",
      outcomes:
        "Sử dụng được cấu trúc cốt lõi trong các tình huống quen thuộc và có nền tảng để tiến lên B1.",
      isPublished: true,
    });

    const classId = await ctx.db.insert("classes", {
      tenantId,
      programId,
      teacherId,
      name: "Foundation A2 — Tối 2-4-6",
      code: "DEV-A2-01",
      gradeMin: 6,
      gradeMax: 9,
      level: "A2",
      modality: "Online",
      location: "Google Meet",
      startsOn: "2026-09-14",
      recruiting: true,
      recruitmentStatus: "RECRUITING",
      publicRemainingSeats: false,
      description: "Lớp dữ liệu mẫu phục vụ development.",
      isDemo: true,
      createdAt: now,
    });
    for (const weekday of [1, 3, 5]) {
      await ctx.db.insert("classSchedules", {
        classId,
        weekday,
        startsAt: "19:30",
        endsAt: "21:00",
        timezone: "Asia/Ho_Chi_Minh",
        effectiveFrom: "2026-09-14",
      });
    }
    await ctx.db.insert("enrollments", {
      classId,
      studentId,
      status: "ACTIVE",
      enrolledAt: now,
    });

    const assignmentId = await ctx.db.insert("assignments", {
      tenantId,
      classId,
      createdBy: teacherId,
      title: "Unit 1 — Daily Routines",
      instructions: "Chọn đáp án đúng và trả lời câu cuối.",
      dueAt: Date.parse("2026-09-30T23:59:00+07:00"),
      status: "PUBLISHED",
      maxAttempts: 1,
      mode: "PRACTICE",
      publishedAt: now,
      shuffleQuestions: false,
      shuffleOptions: false,
      createdAt: now,
    });
    await ctx.db.insert("questions", {
      assignmentId,
      type: "SINGLE_CHOICE",
      prompt: "I ___ breakfast at 7 a.m. every day.",
      options: ["have", "has", "having"],
      correctAnswer: "have",
      explanation:
        "Với chủ ngữ “I” ở thì hiện tại đơn, động từ giữ nguyên mẫu: “I have breakfast”.",
      points: 1,
      position: 1,
    });
    await ctx.db.insert("questions", {
      assignmentId,
      type: "TRUE_FALSE",
      prompt: "“She goes to school” is grammatically correct.",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation:
        "Chủ ngữ ngôi thứ ba số ít “She” dùng động từ thêm -es: “goes”.",
      points: 1,
      position: 2,
    });
    await ctx.db.insert("questions", {
      assignmentId,
      type: "SHORT_ANSWER",
      prompt: "Write one sentence about your morning routine.",
      points: 3,
      position: 3,
    });
    await ctx.db.insert("attempts", {
      assignmentId,
      studentId,
      attemptNo: 1,
      status: "IN_PROGRESS",
      answers: {},
      startedAt: now,
      savedAt: now,
    });

    const trackId = await ctx.db.insert("learningTracks", {
      tenantId,
      slug: "ielts",
      title: "Luyện thi IELTS",
      summary:
        "Lộ trình luyện thi theo bốn kỹ năng, có chẩn đoán đầu vào, luyện tập theo dạng bài và thi thử định kỳ.",
      target: "Xây nền tảng và tiến tới band mục tiêu",
      status: "PUBLISHED",
      position: 20,
      createdAt: now,
      updatedAt: now,
    });
    for (const module of IELTS_MODULES) {
      await ctx.db.insert("learningModules", {
        trackId,
        ...module,
        isPublished: true,
      });
    }

    await ctx.db.insert("auditLogs", {
      tenantId,
      actorId: teacherId,
      action: "SEED",
      entityType: "DEVELOPMENT",
      createdAt: now,
    });

    return { tenantId, seeded: true };
  },
});

export const bootstrapAdmin = mutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    let tenant = await ctx.db.query("tenants").first();
    const now = Date.now();
    if (!tenant) {
      const tenantId = await ctx.db.insert("tenants", {
        name: "TEDUENGLISH",
        createdAt: now,
      });
      tenant = (await ctx.db.get(tenantId))!;
      await ctx.db.insert("siteSettings", {
        tenantId,
        ...DEFAULT_SITE,
        updatedAt: now,
      });
      const groupId = await ctx.db.insert("permissionGroups", {
        tenantId,
        name: "Học viên",
        description: "Quyền mặc định cho người học",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      for (const menuKey of LEARNER_MENUS) {
        await ctx.db.insert("permissionGroupMenus", { groupId, menuKey });
      }
      const trackId = await ctx.db.insert("learningTracks", {
        tenantId,
        slug: "ielts",
        title: "Luyện thi IELTS",
        summary:
          "Lộ trình luyện thi theo bốn kỹ năng, có chẩn đoán đầu vào, luyện tập theo dạng bài và thi thử định kỳ.",
        target: "Xây nền tảng và tiến tới band mục tiêu",
        status: "PUBLISHED",
        position: 20,
        createdAt: now,
        updatedAt: now,
      });
      for (const module of IELTS_MODULES) {
        await ctx.db.insert("learningModules", {
          trackId,
          ...module,
          isPublished: true,
        });
      }
    }
    const admins = (
      await ctx.db
        .query("users")
        .withIndex("by_tenant_role", (q) =>
          q.eq("tenantId", tenant!._id).eq("role", "ADMIN"),
        )
        .collect()
    ).filter((u) => !u.deletedAt);
    if (admins.length) throw new Error("An administrator already exists; bootstrap aborted");
    await ctx.db.insert("users", {
      tenantId: tenant._id,
      email: args.email.toLowerCase(),
      passwordHash: args.passwordHash,
      name: "Quản trị viên",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: now,
    });
    return { ok: true };
  },
});
