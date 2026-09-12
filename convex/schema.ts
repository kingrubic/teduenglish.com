import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    role: v.union(v.literal("ADMIN"), v.literal("MOD"), v.literal("USER")),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("SUSPENDED"),
    ),
    departmentId: v.optional(v.id("departments")),
    mustChangePassword: v.optional(v.boolean()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_role", ["tenantId", "role"])
    .index("by_department", ["departmentId"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),

  loginAttempts: defineTable({
    emailHash: v.string(),
    ipHash: v.string(),
    succeeded: v.boolean(),
    attemptedAt: v.number(),
  }).index("by_email_ip", ["emailHash", "ipHash"]),

  programs: defineTable({
    tenantId: v.id("tenants"),
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    audience: v.string(),
    outcomes: v.string(),
    isPublished: v.boolean(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_slug", ["slug"])
    .index("by_published", ["isPublished"]),

  classes: defineTable({
    tenantId: v.id("tenants"),
    programId: v.optional(v.id("programs")),
    teacherId: v.id("users"),
    name: v.string(),
    code: v.string(),
    gradeMin: v.number(),
    gradeMax: v.number(),
    level: v.string(),
    modality: v.string(),
    location: v.optional(v.string()),
    startsOn: v.string(),
    endsOn: v.optional(v.string()),
    recruiting: v.boolean(),
    recruitmentStatus: v.union(
      v.literal("RECRUITING"),
      v.literal("UPCOMING"),
      v.literal("FULL"),
      v.literal("CLOSED"),
    ),
    capacity: v.optional(v.number()),
    publicRemainingSeats: v.boolean(),
    description: v.string(),
    publicOnlineInfo: v.optional(v.string()),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_code", ["tenantId", "code"])
    .index("by_teacher", ["teacherId"])
    .index("by_program", ["programId"])
    .index("by_status", ["recruitmentStatus"]),

  enrollments: defineTable({
    classId: v.id("classes"),
    studentId: v.id("users"),
    status: v.string(),
    enrolledAt: v.number(),
  })
    .index("by_class", ["classId"])
    .index("by_student", ["studentId"])
    .index("by_class_student", ["classId", "studentId"]),

  classSchedules: defineTable({
    classId: v.id("classes"),
    weekday: v.number(),
    startsAt: v.string(),
    endsAt: v.string(),
    timezone: v.string(),
    effectiveFrom: v.optional(v.string()),
    effectiveTo: v.optional(v.string()),
    locationOverride: v.optional(v.string()),
  }).index("by_class", ["classId"]),

  scheduleExceptions: defineTable({
    classId: v.id("classes"),
    scheduleId: v.optional(v.id("classSchedules")),
    exceptionDate: v.string(),
    type: v.union(
      v.literal("CANCELLED"),
      v.literal("MAKEUP"),
      v.literal("TIME_CHANGE"),
      v.literal("LOCATION_CHANGE"),
    ),
    startsAt: v.optional(v.string()),
    endsAt: v.optional(v.string()),
    location: v.optional(v.string()),
    note: v.string(),
    createdAt: v.number(),
  }).index("by_class", ["classId"]),

  resources: defineTable({
    tenantId: v.id("tenants"),
    title: v.string(),
    description: v.string(),
    mimeType: v.string(),
    storageId: v.optional(v.id("_storage")),
    originalName: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  resourceClassAccess: defineTable({
    resourceId: v.id("resources"),
    classId: v.id("classes"),
  })
    .index("by_resource", ["resourceId"])
    .index("by_class", ["classId"]),

  assignments: defineTable({
    tenantId: v.id("tenants"),
    classId: v.id("classes"),
    createdBy: v.id("users"),
    title: v.string(),
    instructions: v.string(),
    dueAt: v.optional(v.number()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("PUBLISHED"),
      v.literal("ARCHIVED"),
    ),
    maxAttempts: v.number(),
    mode: v.union(v.literal("PRACTICE"), v.literal("EXAM")),
    publishedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    shuffleQuestions: v.boolean(),
    shuffleOptions: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_class", ["classId"]),

  questions: defineTable({
    assignmentId: v.id("assignments"),
    type: v.union(
      v.literal("SINGLE_CHOICE"),
      v.literal("TRUE_FALSE"),
      v.literal("SHORT_ANSWER"),
    ),
    prompt: v.string(),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    explanation: v.optional(v.string()),
    points: v.number(),
    position: v.number(),
  }).index("by_assignment", ["assignmentId"]),

  attempts: defineTable({
    assignmentId: v.id("assignments"),
    studentId: v.id("users"),
    attemptNo: v.number(),
    status: v.union(
      v.literal("IN_PROGRESS"),
      v.literal("SUBMITTED"),
      v.literal("PENDING_GRADING"),
      v.literal("GRADED"),
    ),
    answers: v.any(),
    score: v.optional(v.number()),
    startedAt: v.number(),
    savedAt: v.number(),
    submittedAt: v.optional(v.number()),
    gradedAt: v.optional(v.number()),
    teacherFeedback: v.optional(v.string()),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_student", ["studentId"])
    .index("by_assignment_student", ["assignmentId", "studentId"]),

  questionBankItems: defineTable({
    tenantId: v.id("tenants"),
    createdBy: v.id("users"),
    type: v.union(
      v.literal("SINGLE_CHOICE"),
      v.literal("TRUE_FALSE"),
      v.literal("SHORT_ANSWER"),
    ),
    prompt: v.string(),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    explanation: v.optional(v.string()),
    points: v.number(),
    tags: v.array(v.string()),
    sourceFilename: v.optional(v.string()),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"]),

  enrollmentInquiries: defineTable({
    tenantId: v.id("tenants"),
    fullName: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    programId: v.optional(v.id("programs")),
    currentLevel: v.string(),
    note: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  auditLogs: defineTable({
    tenantId: v.id("tenants"),
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  siteSettings: defineTable({
    tenantId: v.id("tenants"),
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
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  departments: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  permissionGroups: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  permissionGroupMenus: defineTable({
    groupId: v.id("permissionGroups"),
    menuKey: v.string(),
  }).index("by_group", ["groupId"]),

  userPermissionGroups: defineTable({
    userId: v.id("users"),
    groupId: v.id("permissionGroups"),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"])
    .index("by_user_group", ["userId", "groupId"]),

  workTasks: defineTable({
    tenantId: v.id("tenants"),
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("LOW"),
      v.literal("MEDIUM"),
      v.literal("HIGH"),
      v.literal("URGENT"),
    ),
    status: v.union(
      v.literal("TODO"),
      v.literal("IN_PROGRESS"),
      v.literal("DONE"),
      v.literal("CANCELLED"),
    ),
    dueAt: v.optional(v.number()),
    createdBy: v.id("users"),
    assignedTo: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_assignee", ["assignedTo"]),

  learningTracks: defineTable({
    tenantId: v.id("tenants"),
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    target: v.string(),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("PUBLISHED"),
      v.literal("ARCHIVED"),
    ),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_slug", ["tenantId", "slug"]),

  learningModules: defineTable({
    trackId: v.id("learningTracks"),
    slug: v.string(),
    title: v.string(),
    skill: v.string(),
    summary: v.string(),
    accent: v.string(),
    position: v.number(),
    isPublished: v.boolean(),
  }).index("by_track", ["trackId"]),

  learningUnits: defineTable({
    moduleId: v.id("learningModules"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    unitType: v.union(
      v.literal("LESSON"),
      v.literal("PRACTICE"),
      v.literal("MOCK_TEST"),
      v.literal("RESOURCE"),
    ),
    estimatedMinutes: v.optional(v.number()),
    content: v.any(),
    position: v.number(),
    isPublished: v.boolean(),
  }).index("by_module", ["moduleId"]),

  studentUnitProgress: defineTable({
    studentId: v.id("users"),
    unitId: v.id("learningUnits"),
    status: v.string(),
    score: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_unit", ["unitId"])
    .index("by_student_unit", ["studentId", "unitId"]),
});
