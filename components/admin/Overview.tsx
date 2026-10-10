"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { stamp } from "@/lib/ui";
import { Swoosh } from "@/components/site/parts";
import { useAdmin } from "./AdminShell";

export default function Overview() {
  const { token, me } = useAdmin();
  const data = useQuery(api.admin.overview, { token });

  return (
    <>
      <section className="banner view-enter">
        <Swoosh />
        <p className="eyebrow">Teacher only</p>
        <h1>Chào {me.name}!</h1>
        <p>Quản lý mã học sinh, thư mục, bài làm trên web và xem điểm cả lớp tại một chỗ. Mọi thay đổi hiện ngay trên trang học sinh.</p>
        {data && (
          <div className="banner-meta">
            <span>{data.counts.attemptsWeek} lượt nộp bài trong 7 ngày</span>
            <span>{data.counts.activeStudentsWeek} học sinh hoạt động</span>
          </div>
        )}
      </section>

      {!data ? (
        <p className="empty" style={{ marginTop: 18 }}>
          Đang tải…
        </p>
      ) : (
        <>
          <div className="stats-row">
            <Link className="stat-tile" href="/admin/hoc-sinh" style={{ textDecoration: "none" }}>
              <b>{data.counts.students}</b>
              <span>học sinh có mã{data.counts.studentsLocked ? ` · ${data.counts.studentsLocked} đang khóa` : ""}</span>
            </Link>
            <Link className="stat-tile" href="/admin/thu-muc" style={{ textDecoration: "none" }}>
              <b>{data.counts.folders}</b>
              <span>thư mục bài học</span>
            </Link>
            <Link className="stat-tile" href="/admin/bai-lam" style={{ textDecoration: "none" }}>
              <b>{data.counts.quizzes}</b>
              <span>bài làm trên web{data.counts.quizzesDraft ? ` · ${data.counts.quizzesDraft} bản nháp` : ""}</span>
            </Link>
            <Link className="stat-tile" href="/admin/tai-lieu" style={{ textDecoration: "none" }}>
              <b>{data.counts.resources}</b>
              <span>tài liệu &amp; liên kết</span>
            </Link>
          </div>

          <div className="t-grid two">
            <section className="panel">
              <div className="toolbar">
                <div>
                  <p className="eyebrow">Mới nhất</p>
                  <h2>Bài vừa nộp</h2>
                </div>
                <Link className="btn btn-ghost btn-sm" href="/admin/ket-qua">
                  Xem tất cả kết quả
                </Link>
              </div>
              {data.latest.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Học sinh</th>
                        <th>Bài</th>
                        <th className="num">Điểm</th>
                        <th>Lúc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.latest.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <b>{a.studentName}</b>
                            <span className="sub">{a.className}</span>
                          </td>
                          <td>{a.quizTitle}</td>
                          <td className="num">
                            {a.correct}/{a.total}
                            {a.band != null && <span className="sub">Band {a.band.toFixed(1)}</span>}
                          </td>
                          <td className="tiny muted">{stamp(a.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty">Chưa có bài nộp nào trong 7 ngày qua.</p>
              )}
            </section>

            <section className="panel">
              <div className="toolbar">
                <div>
                  <p className="eyebrow">Hướng dẫn nhanh</p>
                  <h2>Giao bài cho lớp</h2>
                </div>
                <Link className="btn btn-primary btn-sm" href="/admin/huong-dan">
                  📖 Xem hướng dẫn đầy đủ
                </Link>
              </div>
              <ol className="steps">
                <li>
                  Vào <Link href="/admin/hoc-sinh">Học sinh</Link> → <b>Thêm nhiều học sinh</b>: dán danh sách lớp, chọn thư mục được mở. Hệ thống tự tạo mã cho từng em.
                </li>
                <li>
                  Vào <Link href="/admin/bai-lam">Bài làm trên web</Link> để soạn bài trắc nghiệm, điền từ, nghe hoặc đọc. Bài có thể đặt <b>mã bài</b> riêng.
                </li>
                <li>
                  Vào <Link href="/admin/tai-lieu">Tài liệu &amp; liên kết</Link> để thêm link Quizlet, Wordwall, Google Drive, YouTube…
                </li>
                <li>Gửi mã cá nhân cho từng em. Em vào trang chủ, nhập mã là thấy đúng bài được giao.</li>
                <li>
                  Điểm tự lưu về <Link href="/admin/ket-qua">Kết quả</Link>, lọc theo lớp, bài hoặc học sinh và tải về file CSV.
                </li>
              </ol>
            </section>
          </div>
        </>
      )}
    </>
  );
}
