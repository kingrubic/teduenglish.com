# Product architecture và MVP plan

## Sitemap

### Public

- `/` — Trang chủ
- `/gioi-thieu`
- `/chuong-trinh`
- `/chuong-trinh/[slug]`
- `/thoi-khoa-bieu`
- `/dang-ky-tu-van`
- `/bai-viet`
- `/bai-viet/[slug]`
- `/tai-lieu-mien-phi`
- `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau`
- `/sitemap.xml`, `/robots.txt`, `/llms.txt`

### Student Portal

- `/hoc-tap` — dashboard cá nhân
- `/hoc-tap/lop-hoc`
- `/hoc-tap/lop-hoc/[classId]`
- `/hoc-tap/tai-lieu`
- `/hoc-tap/bai-tap`
- `/hoc-tap/bai-tap/[assignmentId]`
- `/hoc-tap/lam-bai/[attemptId]`
- `/hoc-tap/ket-qua/[attemptId]`
- `/hoc-tap/thong-bao`
- `/hoc-tap/tai-khoan`

### Teacher/Admin CMS

- `/cms` — dashboard
- `/cms/lop-hoc`, `/cms/lop-hoc/[id]`
- `/cms/hoc-sinh`, `/cms/hoc-sinh/[id]`
- `/cms/chuong-trinh`, `/cms/bai-hoc`
- `/cms/lich-hoc`
- `/cms/tai-lieu`
- `/cms/ngan-hang-cau-hoi`
- `/cms/bai-tap`, `/cms/bai-tap/[id]`
- `/cms/bai-nop`, `/cms/cham-bai/[attemptId]`
- `/cms/thong-bao`
- `/cms/dang-ky-tu-van`
- `/cms/noi-dung-website`
- `/cms/bao-cao`
- `/cms/nguoi-dung`, `/cms/cai-dat`

## User flows ưu tiên

1. Khách: chương trình → lịch tuyển sinh → đăng ký tư vấn → lead xuất hiện trong CMS.
2. Giáo viên: tạo học sinh → tạo lớp → ghi danh → học sinh chỉ thấy lớp được ghi danh.
3. Giáo viên: upload tài liệu private → cấp quyền theo lớp → đúng enrollment mới nhận signed URL.
4. Giáo viên: tạo câu hỏi → tạo/publish assignment version → giao lớp/cá nhân.
5. Học sinh: bắt đầu attempt → autosave từng câu → reload khôi phục → nộp idempotent → auto-grade.
6. Giáo viên: chấm câu tự luận/file → phản hồi theo câu → publish kết quả theo policy.
7. Giáo viên: sửa lịch lặp/ngoại lệ → public schedule và portal dùng cùng dữ liệu.
8. Giáo viên: sửa content → public website cập nhật không cần deploy code.

## Phạm vi MVP

### P0 — nền móng và an toàn

- Next.js App Router, TypeScript strict, design tokens, i18n foundation.
- PostgreSQL + ORM migrations + development seed.
- Email/password, reset password, secure session, account states.
- RBAC `ADMIN | TEACHER | STUDENT`, tenant scope chuẩn bị cho multi-teacher.
- Validation, structured errors, audit log, pagination và rate-limit adapter.

### P1 — vertical slice vận hành

- CMS chương trình, lớp, lịch, học sinh, enrollment.
- Public chương trình, lịch và đăng ký tư vấn.
- Student dashboard và lớp học cá nhân.
- Resource upload metadata, access policy và signed download.
- Question bank, assignment version, assignment target.
- Attempt autosave/resume/submit, auto-grade dạng xác định.
- Manual grading cho writing, short answer và file submission.

### P2 — hoàn thiện MVP

- CMS website content, bài viết, FAQ, SEO.
- Announcement, báo cáo, CSV export/import preview.
- PDF/image/audio/video preview theo policy.
- Email invite/reset adapter khi có nhà cung cấp.
- Accessibility, responsive QA và E2E đủ 10 acceptance flows.

### Sau MVP

- Google login, nhiều giáo viên hoàn chỉnh, background worker quy mô lớn.
- AI hỗ trợ chấm/nhận xét chỉ ở trạng thái gợi ý, không phải điểm cuối.
- Thanh toán, marketplace, conferencing, gamification, mobile native.

## Kiến trúc kỹ thuật

- Web/app: Next.js App Router + React + TypeScript strict.
- UI: Tailwind CSS + component primitives accessible; server components mặc định.
- Data: PostgreSQL + Prisma; migration có version, transaction cho submit/grade.
- Auth: session cookie `HttpOnly`, `Secure` ở production, `SameSite=Lax`; mật khẩu Argon2id; reset token hash và hết hạn.
- Validation: Zod ở boundary server; không tin dữ liệu client.
- API: server actions/route handlers mỏng → application services → repository/Prisma.
- Storage: S3-compatible adapter; production dùng private bucket + signed URL ngắn hạn; development có local adapter.
- Jobs: interface outbox/job; MVP xử lý đồng bộ phần nhẹ, file/email dài chuyển queue khi cấu hình.
- Observability: structured logs có request ID, audit log nghiệp vụ, không log token/password/file private.
- Security: CSP/security headers, CSRF strategy, rate limit login/form/sensitive endpoints, MIME sniffing + size whitelist.
- Deployment: application container/Node runtime + managed PostgreSQL + private object storage; staging và production tách database/bucket/secrets.

## Boundary phân quyền

- `ADMIN`: quản trị tenant và mọi resource trong tenant.
- `TEACHER`: chỉ resource được sở hữu/gán trong tenant.
- `STUDENT`: chỉ profile của mình và resource có enrollment/target/access hợp lệ.
- Mọi query domain nhận `actor` và `tenantId`; không query bằng ID đơn lẻ rồi mới che UI.
- Attempt/grade luôn kiểm tra `attempt.studentId === actor.userId` hoặc teacher scope.

## Thứ tự triển khai theo phụ thuộc

1. Toolchain, env schema, CI scripts, design shell.
2. Database core: tenant/user/profile/session/audit.
3. Auth + account lifecycle + authorization policy tests.
4. Program/class/enrollment/schedule + CMS cơ bản.
5. Public program/schedule/inquiry + CMS pipeline.
6. Lesson/resource/access + private storage flow.
7. Question bank + immutable versions.
8. Assignment/target/attempt/autosave/submit/auto-grade.
9. Manual grading/result policy/reporting.
10. Website CMS/blog/SEO, imports/exports, full E2E and deployment docs.

