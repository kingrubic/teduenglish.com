export type MenuItem = {
  key: string;
  label: string;
  href: string;
  scope: "cms" | "portal";
  adminOnly?: boolean;
};

export const MENU_ITEMS: MenuItem[] = [
  { key: "cms.dashboard", label: "Tổng quan", href: "/cms", scope: "cms" },
  {
    key: "cms.tasks",
    label: "Công việc",
    href: "/cms/cong-viec",
    scope: "cms",
  },
  { key: "cms.classes", label: "Lớp học", href: "/cms/lop-hoc", scope: "cms" },
  {
    key: "cms.students",
    label: "Học sinh",
    href: "/cms/hoc-sinh",
    scope: "cms",
  },
  {
    key: "cms.ielts",
    label: "Luyện thi IELTS",
    href: "/cms/ielts",
    scope: "cms",
  },
  {
    key: "cms.resources",
    label: "Tài liệu",
    href: "/cms/tai-lieu",
    scope: "cms",
  },
  {
    key: "cms.question_bank",
    label: "Ngân hàng đề",
    href: "/cms/ngan-hang-de",
    scope: "cms",
  },
  {
    key: "cms.assignments",
    label: "Bài tập",
    href: "/cms/bai-tap",
    scope: "cms",
  },
  {
    key: "cms.inquiries",
    label: "Đăng ký tư vấn",
    href: "/cms/dang-ky-tu-van",
    scope: "cms",
  },
  {
    key: "cms.brand",
    label: "Thương hiệu",
    href: "/cms/thuong-hieu",
    scope: "cms",
  },
  {
    key: "admin.users",
    label: "Tài khoản & phân quyền",
    href: "/cms/nguoi-dung",
    scope: "cms",
    adminOnly: true,
  },
  {
    key: "admin.departments",
    label: "Phòng ban",
    href: "/cms/phong-ban",
    scope: "cms",
    adminOnly: true,
  },
  {
    key: "admin.permission_groups",
    label: "Nhóm quyền",
    href: "/cms/nhom-quyen",
    scope: "cms",
    adminOnly: true,
  },
  {
    key: "portal.dashboard",
    label: "Tổng quan",
    href: "/hoc-tap",
    scope: "portal",
  },
  {
    key: "portal.classes",
    label: "Lớp học",
    href: "/hoc-tap/lop-hoc",
    scope: "portal",
  },
  {
    key: "portal.ielts",
    label: "Luyện thi IELTS",
    href: "/hoc-tap/ielts",
    scope: "portal",
  },
  {
    key: "portal.resources",
    label: "Tài liệu",
    href: "/hoc-tap/tai-lieu",
    scope: "portal",
  },
  {
    key: "portal.assignments",
    label: "Bài tập",
    href: "/hoc-tap/bai-tap",
    scope: "portal",
  },
  {
    key: "portal.tasks",
    label: "Công việc của tôi",
    href: "/hoc-tap/cong-viec",
    scope: "portal",
  },
];

export const menuByKey = (key: string) =>
  MENU_ITEMS.find((item) => item.key === key);
