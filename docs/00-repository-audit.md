# Repository audit — English Learning Hub

Ngày audit: 2026-09-07

## Kết luận

Workspace chưa có source code phù hợp để tiếp tục phát triển English Learning Hub. Thư mục gần nhất là `lvt-school-platform/`, nhưng đây là prototype quản trị nội bộ của một trường THCS, chỉ gồm một file HTML tĩnh và một logo. Prototype này không có backend, database, authentication, API, migration, test hay package manifest; domain và luồng nghiệp vụ cũng khác với LMS cho giáo viên tiếng Anh cá nhân.

Vì vậy dự án mới phải được tạo trong `english-learning-hub/`. Không xóa hoặc ghi đè `lvt-school-platform/`; có thể tham khảo các screenshot hiện có về mật độ thông tin và responsive, nhưng không tái sử dụng dữ liệu/trường học hoặc giả định đó là sản phẩm đang hoạt động.

## Thành phần đã kiểm tra

- `lvt-school-platform/index.html`: 1.407 dòng HTML/CSS/JavaScript trong một file.
- `lvt-school-platform/assets/logo-thcs-le-van-tam.png`: tài sản nhận diện của dự án khác.
- `lvt-acceptance-platform/` và `lvt-acceptance-platform.zip`: công cụ acceptance/backlog tĩnh cho dự án trường học khác.
- Không tìm thấy `package.json`, ORM schema, migration, API route, auth config hoặc test trong `lvt-school-platform/`.
- Workspace root là worktree dùng chung chứa nhiều dự án không liên quan và rất nhiều file chưa được Git quản lý. Mọi thay đổi của dự án này phải giới hạn trong `english-learning-hub/`.

## Khoảng cách so với brief

- Public website: chưa có.
- Student Portal: chưa có.
- Teacher/Admin CMS: prototype hiện tại không đúng domain và không có persistence.
- Authentication/RBAC: chưa có.
- PostgreSQL/schema/migrations: chưa có.
- Object storage và signed URL: chưa có.
- Assignment/Quiz Engine, autosave, snapshot, grading: chưa có.
- Validation, rate limiting, audit log, pagination: chưa có.
- Unit/integration/E2E tests: chưa có.
- SEO, sitemap, structured data, i18n foundation: chưa có.

## Quyết định audit

1. Tạo project mới, không chuyển đổi prototype HTML vì chi phí tháo gỡ cao hơn scaffold đúng kiến trúc.
2. PostgreSQL là nguồn dữ liệu chuẩn; ORM migration bắt buộc.
3. Authorization được kiểm tra server-side dựa trên role, ownership và enrollment; route guard phía client chỉ hỗ trợ UX.
4. Nội dung website cũng lưu trong cùng hệ dữ liệu để giáo viên chỉnh qua CMS.
5. Tài liệu private không dùng URL public; database lưu object key, backend phát signed URL sau khi kiểm tra quyền.
6. Question/assignment dùng immutable version snapshot để lịch sử bài làm và điểm không bị thay đổi khi ngân hàng câu hỏi được sửa.

## Rủi ro cần khóa sớm

- Chưa có tên thương hiệu, domain, hồ sơ giáo viên, ảnh thật và kênh liên hệ: dùng placeholder có nhãn cấu hình, không bịa nội dung.
- Chưa có nhà cung cấp production cho PostgreSQL, email và object storage: thiết kế adapter/env trước, chọn vendor khi deploy.
- Brief rất lớn: nghiệm thu theo vertical slice hoạt động hoàn chỉnh, không nghiệm thu theo số lượng màn hình.

