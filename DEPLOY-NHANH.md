# Triển khai TEDUENGLISH

## 1. Chuẩn bị

- Máy chủ chạy Docker hoặc Node.js 22.
- Convex backend (local khi phát triển, Convex Cloud khi production).
- Domain đã trỏ DNS về máy chủ.
- HTTPS qua Cloudflare hoặc reverse proxy.

## 2. Cấu hình

Sao chép `.env.example` thành `.env.local` và điền:

- `NEXT_PUBLIC_CONVEX_URL`: URL Convex, ví dụ `http://127.0.0.1:3210` (local) hoặc URL Convex Cloud.
- `APP_URL`: domain đầy đủ, ví dụ `https://teduenglish.com`.
- `NODE_ENV=production`.
- `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`: chỉ dùng một lần để tạo Admin đầu tiên, sau đó xóa khỏi môi trường.
- `QUESTION_AI_ENDPOINT` và `QUESTION_AI_TOKEN`: tùy chọn nếu dùng AI/OCR đọc đề linh hoạt.

Không upload `.env.local` lên Git hoặc gửi công khai.

## 3. Cài đặt local

```bash
npm ci
npx convex dev --once
npm run db:seed
npm run build
npm start
```

## 4. Production

1. `npx convex login` rồi `npx convex deploy`.
2. Đặt `NEXT_PUBLIC_CONVEX_URL` thành URL production.
3. `npm run db:bootstrap` một lần để tạo Admin.
4. `npm run build && npm start` hoặc build Docker.

## 5. Kiểm tra sau triển khai

- `/api/health` trả về `status: ok`.
- Trang chủ, Giới thiệu, Chương trình, Thời khóa biểu hoạt động.
- Admin đăng nhập được và đổi mật khẩu.
- Tạo học sinh, thêm vào lớp, upload tài liệu.
- Tạo bài luyện tập và bài kiểm tra.
- Học sinh làm/nộp bài; giáo viên xem và chấm bài.
- `/robots.txt`, `/sitemap.xml` và `/llms.txt` hoạt động.

Tài liệu chi tiết: `docs/03-production-deploy.md`.
