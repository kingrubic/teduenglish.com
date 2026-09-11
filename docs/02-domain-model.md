# Domain model

## Identity và tenancy

- `Tenant`: ranh giới dữ liệu; MVP có một tenant nhưng mọi entity nghiệp vụ mang `tenantId`.
- `User`: email chuẩn hóa, password hash, role, status, lastLoginAt, soft-delete metadata.
- `Profile`: tên hiển thị, điện thoại tối thiểu cần thiết, avatar và metadata theo role.
- `Session`, `PasswordResetToken`: token chỉ lưu dạng hash, có expiry/revocation.
- `AuditLog`: actor, action, entity type/id, metadata đã lọc, timestamp.

## Học vụ

- `Program` 1—N `Class`.
- `Class` N—N `Student` qua `Enrollment`; enrollment là nguồn kiểm tra quyền.
- `Class` 1—N `ClassSchedule`; lịch lặp lưu timezone + recurrence rule.
- `ClassSchedule` 1—N `ScheduleException` cho nghỉ, học bù, đổi giờ/phòng.
- `Program/Class` 1—N `Lesson`; lesson có order và draft/published.
- `Announcement` target class hoặc student cụ thể.

## Không gian học tập và IELTS

- `LearningTrack`: nhánh học tập cấp cao như IELTS; có lifecycle draft/published/archived và thứ tự hiển thị.
- `LearningModule`: nhóm nội dung theo kỹ năng hoặc giai đoạn, ví dụ Listening, Reading, Writing, Speaking và Mock test.
- `LearningUnit`: đơn vị CMS có thể xuất bản độc lập, gồm bài học, luyện tập, thi thử hoặc tài liệu; nội dung đa hình lưu trong payload JSON có schema.
- `StudentUnitProgress`: tiến độ theo học sinh và đơn vị học, tách khỏi enrollment để một lộ trình có thể dùng chung cho nhiều lớp.
- IELTS đi theo chu trình `chẩn đoán → chiến lược → luyện dạng bài → thi thử & phản hồi`; điểm thi thử sau này liên kết với attempt thay vì lưu chồng trong content.

## Tài liệu

- `MediaAsset`: object key, MIME khai báo và MIME phát hiện, size, checksum, trạng thái scan.
- `Resource`: metadata học tập và download policy, có version.
- `ResourceAccess`: scope `PUBLIC | CLASS | STUDENT`; nhiều dòng cho nhiều target.
- Truy cập private: authorize → signed URL thời hạn ngắn; không lưu public URL.

## Bài tập và versioning

- `Question`: identity và metadata tìm kiếm.
- `QuestionVersion`: payload immutable gồm loại câu, prompt, đáp án, giải thích, media, rubric.
- `QuestionOption`: thuộc version; order và correctness nằm trong snapshot.
- `Assignment`: identity, lifecycle và owner.
- `AssignmentVersion`: cấu hình immutable khi publish: thời gian, attempts, randomization, result policy.
- `AssignmentQuestion`: liên kết assignment version với question version, điểm và order.
- `AssignmentTarget`: class/student, open/close/due overrides nếu cần.
- Khi assignment đã có attempt, chỉnh sửa tạo version mới; attempt cũ giữ version cũ.

## Attempt và grading

- `Attempt`: student, assignment version, ordinal attempt, serverStartedAt, deadlineAt, submittedAt, status, score.
- `AttemptAnswer`: answer JSON theo loại câu, save revision, savedAt, auto score, manual score.
- `Grade`: tổng hợp điểm, trạng thái, grader, gradedAt; thay đổi điểm tạo revision/audit.
- `TeacherFeedback`: feedback theo attempt hoặc answer, author và visibility.
- Submit dùng transaction + idempotency key + unique constraint; server là nguồn thời gian chuẩn.

## Website và tuyển sinh

- `WebsiteContent`: typed section, locale, payload JSON được validate, draft/published version.
- `Post`: slug, nội dung, SEO, visibility và publish state.
- `EnrollmentInquiry`: contact tối thiểu, consent/source, status và assignee.
- `SiteSetting`: liên hệ, Zalo/Messenger, branding, SEO defaults; không chứa secret.

## Ràng buộc quan trọng

- Unique normalized email trong tenant.
- Unique active enrollment `(classId, studentId)`.
- Unique attempt ordinal `(assignmentVersionId, studentId, attemptNo)`.
- Foreign keys dùng restrict/archive ở dữ liệu lịch sử; soft delete cho user, class, question, assignment, resource.
- Index mọi foreign key, status/time filter và cursor pagination.
- JSON chỉ dành cho payload đa hình/version snapshot; quan hệ truy cập và reporting vẫn chuẩn hóa.
