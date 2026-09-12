import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type Actor = {
  id: Id<"users">;
  tenantId: Id<"tenants">;
  email: string;
  name: string;
  role: "ADMIN" | "MOD" | "USER";
  mustChangePassword: boolean;
};

export function iso(value?: number | null) {
  return value == null ? null : new Date(value).toISOString();
}

export function weekdayLabel(weekday: number) {
  return weekday === 0 ? "CN" : `T${weekday + 1}`;
}

export function sessionLabel(weekday: number, startsAt: string) {
  return `${weekdayLabel(weekday)} ${startsAt.slice(0, 5)}`;
}

export async function actorFromHash(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
): Promise<Actor | null> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;
  return {
    id: user._id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function requireActor(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
  roles?: Actor["role"][],
  opts?: { allowMustChangePassword?: boolean },
) {
  const actor = await actorFromHash(ctx, tokenHash);
  if (!actor) throw new Error("Unauthorized");
  if (actor.mustChangePassword && !opts?.allowMustChangePassword)
    throw new Error("Phải đổi mật khẩu trước khi tiếp tục");
  if (roles && !roles.includes(actor.role)) throw new Error("Forbidden");
  return actor;
}

export function canManage(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "MOD";
}

export async function audit(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: unknown,
) {
  await ctx.db.insert("auditLogs", {
    tenantId: actor.tenantId,
    actorId: actor.id,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: Date.now(),
  });
}

export async function classAccess(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  classId: Id<"classes">,
) {
  const cls = await ctx.db.get(classId);
  if (!cls || cls.tenantId !== actor.tenantId) return null;
  if (canManage(actor) || cls.teacherId === actor.id) return cls;
  return null;
}

export async function ensureAttemptsForClass(
  ctx: MutationCtx,
  assignmentId: Id<"assignments">,
  classId: Id<"classes">,
) {
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const now = Date.now();
  for (const enrollment of enrollments) {
    if (enrollment.status !== "ACTIVE") continue;
    const existing = await ctx.db
      .query("attempts")
      .withIndex("by_assignment_student", (q) =>
        q.eq("assignmentId", assignmentId).eq("studentId", enrollment.studentId),
      )
      .unique();
    if (existing) continue;
    await ctx.db.insert("attempts", {
      assignmentId,
      studentId: enrollment.studentId,
      attemptNo: 1,
      status: "IN_PROGRESS",
      answers: {},
      startedAt: now,
      savedAt: now,
    });
  }
}

export async function learnerGroupId(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
) {
  const groups = await ctx.db
    .query("permissionGroups")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  return groups.find((g) => g.name === "Học viên" && g.status === "ACTIVE")?._id;
}

export async function menuKeysForUser(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
) {
  const links = await ctx.db
    .query("userPermissionGroups")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const keys = new Set<string>();
  for (const link of links) {
    const group = await ctx.db.get(link.groupId);
    if (!group || group.status !== "ACTIVE" || group.tenantId !== user.tenantId)
      continue;
    const menus = await ctx.db
      .query("permissionGroupMenus")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    for (const menu of menus) keys.add(menu.menuKey);
  }
  return [...keys];
}

export async function firstTenant(ctx: QueryCtx | MutationCtx) {
  return ctx.db.query("tenants").first();
}

export const DEFAULT_SITE = {
  brandName: "TEDUENGLISH",
  tagline: "Better English · Brighter Futures",
  teacherName: "Lê Hữu Thanh Toàn",
  teacherTitle:
    "Giáo viên giảng dạy môn Tiếng Anh và Tổ phó Tổ Tiếng Anh",
  teacherOrganization:
    "Trường THCS Lê Văn Tám, phường Bình Thạnh, TP.HCM",
  teacherShortBio:
    "Thầy Lê Hữu Thanh Toàn xây dựng môi trường học tiếng Anh có hệ thống, kết nối hoạt động trên lớp với việc tự học tại nhà.",
  teacherLongBio:
    "Thầy Lê Hữu Thanh Toàn hiện là giáo viên giảng dạy môn Tiếng Anh và giữ vai trò Tổ phó Tổ Tiếng Anh tại Trường THCS Lê Văn Tám, phường Bình Thạnh, TP.HCM.\n\nVới định hướng xây dựng một môi trường học tập có hệ thống, thầy mong muốn giúp học sinh tiếp cận tiếng Anh một cách rõ ràng, từng bước củng cố nền tảng kiến thức và phát triển sự tự tin trong quá trình học tập. Không gian học trực tuyến này được xây dựng để kết nối hoạt động giảng dạy trên lớp với việc tự học tại nhà, giúp học sinh dễ dàng theo dõi thời khóa biểu, truy cập tài liệu, hoàn thành bài tập và nhìn lại tiến độ của bản thân.\n\nThông qua sự kết hợp giữa phương pháp giảng dạy và công nghệ giáo dục, website hướng đến việc tạo ra một hành trình học tập thuận tiện, nhất quán và có sự đồng hành giữa giáo viên, học sinh và phụ huynh.",
  seoTitle: "TEDUENGLISH | Học tiếng Anh cùng thầy Lê Hữu Thanh Toàn",
  seoDescription:
    "TEDUENGLISH — không gian học tiếng Anh có lộ trình, có phản hồi cùng thầy Lê Hữu Thanh Toàn.",
};

export const LEARNER_MENUS = [
  "portal.dashboard",
  "portal.classes",
  "portal.ielts",
  "portal.resources",
  "portal.assignments",
  "portal.tasks",
];

export const IELTS_MODULES = [
  {
    slug: "listening",
    title: "IELTS Listening",
    skill: "Listening",
    summary: "Luyện nghe theo section, nhận diện bẫy và kiểm soát chính tả.",
    accent: "blue",
    position: 10,
  },
  {
    slug: "reading",
    title: "IELTS Reading",
    skill: "Reading",
    summary: "Đọc chiến lược theo dạng câu hỏi, quản trị thời gian và bằng chứng.",
    accent: "green",
    position: 20,
  },
  {
    slug: "writing",
    title: "IELTS Writing",
    skill: "Writing",
    summary: "Phát triển Task 1, Task 2 theo tiêu chí chấm điểm IELTS.",
    accent: "orange",
    position: 30,
  },
  {
    slug: "speaking",
    title: "IELTS Speaking",
    skill: "Speaking",
    summary:
      "Rèn phản xạ, độ trôi chảy và cách phát triển câu trả lời tự nhiên.",
    accent: "purple",
    position: 40,
  },
  {
    slug: "mock-test",
    title: "Thi thử & phân tích",
    skill: "Mock test",
    summary:
      "Thi thử theo chặng và biến kết quả thành kế hoạch cải thiện.",
    accent: "dark",
    position: 50,
  },
];
