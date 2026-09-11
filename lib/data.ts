import { api, convex } from "@/lib/convex";
import { requireSessionHash } from "@/lib/auth";
import type { Id } from "@/convex/_generated/dataModel";

function rows<T>(data: T[]) {
  return { rows: data, rowCount: data.length };
}

export const data = {
  async publishedPrograms(limit?: number) {
    return rows(await convex().query(api.public.publishedPrograms, { limit }));
  },
  async programBySlug(slug: string) {
    const program = await convex().query(api.public.programBySlug, { slug });
    return rows(program ? [program] : []);
  },
  async homeClasses() {
    return rows(await convex().query(api.public.homeClasses, {}));
  },
  async timetable() {
    return rows(await convex().query(api.public.timetable, {}));
  },
  async classDetail(id: string) {
    return convex().query(api.public.classDetail, { id: id as Id<"classes"> });
  },
  async cmsDashboard() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.dashboard, { tokenHash });
  },
  async classOptions(excludeClosed = false) {
    const tokenHash = await requireSessionHash();
    return rows(
      await convex().query(api.cms.classOptions, { tokenHash, excludeClosed }),
    );
  },
  async programOptions() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.programOptions, { tokenHash }));
  },
  async classList() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.classList, { tokenHash }));
  },
  async classManage(id: string) {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.classManage, {
      tokenHash,
      id: id as Id<"classes">,
    });
  },
  async studentsPage() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.studentsPage, { tokenHash });
  },
  async resourcesPage() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.resourcesPage, { tokenHash });
  },
  async assignmentList() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.assignmentList, { tokenHash }));
  },
  async assignmentDetail(id: string) {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.assignmentDetail, {
      tokenHash,
      id: id as Id<"assignments">,
    });
  },
  async questionBankPage() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.questionBankPage, { tokenHash });
  },
  async usersPage() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.usersPage, { tokenHash });
  },
  async inquiries() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.inquiries, { tokenHash }));
  },
  async departmentsPage() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.departmentsPage, { tokenHash }));
  },
  async permissionGroupsPage() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.cms.permissionGroupsPage, { tokenHash }));
  },
  async tasksPage() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.tasksPage, { tokenHash });
  },
  async ieltsCms() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.cms.ieltsCms, { tokenHash });
  },
  async portalDashboard() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.portal.dashboard, { tokenHash });
  },
  async myClasses() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.portal.myClasses, { tokenHash }));
  },
  async myAssignments() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.portal.myAssignments, { tokenHash }));
  },
  async myResources() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.portal.myResources, { tokenHash }));
  },
  async attemptPage(attemptId: string) {
    const tokenHash = await requireSessionHash();
    return convex().query(api.portal.attemptPage, {
      tokenHash,
      attemptId: attemptId as Id<"attempts">,
    });
  },
  async resultPage(attemptId: string) {
    const tokenHash = await requireSessionHash();
    return convex().query(api.portal.resultPage, {
      tokenHash,
      attemptId: attemptId as Id<"attempts">,
    });
  },
  async myTasks() {
    const tokenHash = await requireSessionHash();
    return rows(await convex().query(api.portal.myTasks, { tokenHash }));
  },
  async ieltsLearning() {
    const tokenHash = await requireSessionHash();
    return convex().query(api.portal.ieltsLearning, { tokenHash });
  },
};
