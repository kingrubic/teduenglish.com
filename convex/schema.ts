import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const questionValidator = v.union(
  v.object({
    type: v.literal("mcq"),
    tag: v.optional(v.string()),
    q: v.string(),
    options: v.array(v.string()),
    answer: v.number(),
    explain: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("fill"),
    tag: v.optional(v.string()),
    q: v.string(),
    answer: v.array(v.string()),
    explain: v.optional(v.string()),
  }),
);

export const sectionValidator = v.object({
  title: v.string(),
  listen: v.optional(v.string()),
  passage: v.optional(v.string()),
  questions: v.array(questionValidator),
});

export const ieltsValidator = v.optional(
  v.union(v.literal("listening"), v.literal("reading")),
);

export const resourceKindValidator = v.union(
  v.literal("exercise"),
  v.literal("game"),
  v.literal("video"),
  v.literal("doc"),
);

export default defineSchema({
  // Single row: center name, contact, demo hint...
  settings: defineTable({
    centerName: v.string(),
    tagline: v.string(),
    teacher: v.string(),
    contact: v.string(),
    showDemoHint: v.boolean(),
    demoCode: v.string(),
    updatedAt: v.number(),
  }),

  folders: defineTable({
    slug: v.string(),
    badge: v.string(),
    name: v.string(),
    detail: v.string(),
    order: v.number(),
  }).index("by_slug", ["slug"]),

  students: defineTable({
    code: v.string(), // normalized (lowercase, no spaces)
    name: v.string(),
    className: v.string(),
    folders: v.array(v.string()), // folder slugs, or ["*"] for all
    active: v.boolean(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_class", ["className"]),

  studentSessions: defineTable({
    studentId: v.id("students"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_student", ["studentId"])
    .index("by_expiresAt", ["expiresAt"]),

  resources: defineTable({
    folder: v.string(),
    kind: resourceKindValidator,
    title: v.string(),
    description: v.string(),
    url: v.string(), // "" when the resource is an uploaded file
    file: v.optional(v.object({ storageId: v.id("_storage"), name: v.string(), size: v.number() })),
    order: v.number(),
  }).index("by_folder", ["folder"]),

  quizzes: defineTable({
    slug: v.string(),
    folder: v.string(),
    title: v.string(),
    subtitle: v.string(),
    minutes: v.number(),
    code: v.string(), // optional unlock code; "" means none
    featured: v.boolean(),
    ielts: ieltsValidator,
    published: v.boolean(),
    order: v.number(),
    sections: v.array(sectionValidator),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_folder", ["folder"]),

  quizUnlocks: defineTable({
    studentId: v.id("students"),
    quizId: v.id("quizzes"),
  }).index("by_student_quiz", ["studentId", "quizId"]),

  attempts: defineTable({
    studentId: v.id("students"),
    quizId: v.id("quizzes"),
    correct: v.number(),
    total: v.number(),
    wrong: v.number(),
    unanswered: v.number(),
    band: v.optional(v.number()),
    answers: v.record(v.string(), v.union(v.string(), v.number())),
    submittedAt: v.number(),
  })
    .index("by_student", ["studentId", "submittedAt"])
    .index("by_quiz", ["quizId", "submittedAt"])
    .index("by_submittedAt", ["submittedAt"]),

  admins: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("owner"), v.literal("teacher")),
    active: v.boolean(),
    mustChangePassword: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  adminSessions: defineTable({
    adminId: v.id("admins"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_admin", ["adminId"])
    .index("by_expiresAt", ["expiresAt"]),

  loginAttempts: defineTable({
    kind: v.union(v.literal("student"), v.literal("admin")),
    key: v.string(),
    ok: v.boolean(),
    at: v.number(),
  })
    .index("by_kind_at", ["kind", "at"])
    .index("by_kind_key_at", ["kind", "key", "at"]),
});
