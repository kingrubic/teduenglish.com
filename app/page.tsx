import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { data } from "@/lib/data";

type Program = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  audience: string;
};
type ClassRow = {
  id: string;
  name: string;
  code: string;
  grade_min: number;
  grade_max: number;
  status: string;
  sessions: string;
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const [programs, classes] = await Promise.all([
    data.publishedPrograms(3),
    data.homeClasses(),
  ]);
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                Tiếng Anh có lộ trình · Tiến bộ có căn cứ
              </div>
              <h1>
                <span>Học đúng cách</span>
                <em>Tiến bộ thật</em>
              </h1>
              <p>
                TEDUENGLISH giúp học sinh xây nền tảng vững, học có hệ thống và
                tự tin sử dụng tiếng Anh qua sự đồng hành sát sao của giáo viên.
              </p>
              <div className="hero-actions">
                <Link className="button accent" href="/dang-ky-tu-van">
                  Nhận tư vấn lộ trình <span>→</span>
                </Link>
                <Link className="text-link" href="/thoi-khoa-bieu">
                  Xem lịch học <span>↗</span>
                </Link>
              </div>
              <div className="trust-row">
                <span>
                  <b>01</b> Lộ trình rõ ràng
                </span>
                <span>
                  <b>02</b> Phản hồi liên tục
                </span>
                <span>
                  <b>03</b> Theo dõi tiến bộ
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-logo-card">
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
                <Image
                  src="/teduenglish-logo.png"
                  width={1254}
                  height={888}
                  priority
                  alt="TEDUENGLISH — Better English, Brighter Futures"
                />
                <div className="floating-note note-top">Better English</div>
                <div className="floating-note note-bottom">
                  Brighter Futures ✦
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="manifesto">
          <div className="container manifesto-grid">
            <span className="eyebrow light">Triết lý TEDUENGLISH</span>
            <p>
              Tiếng Anh không phải là môn học để ghi nhớ. Đó là một năng lực
              được hình thành qua{" "}
              <strong>
                lộ trình đúng, luyện tập đều và phản hồi kịp thời.
              </strong>
            </p>
          </div>
        </section>
        <section className="section programs">
          <div className="container">
            <div className="section-title-row">
              <div>
                <div className="eyebrow">Chương trình học</div>
                <h2>Mỗi giai đoạn, một đích đến rõ ràng.</h2>
              </div>
              <Link className="text-link" href="/chuong-trinh">
                Xem tất cả <span>→</span>
              </Link>
            </div>
            <div className="grid-3">
              {programs.rows.map((p, index) => (
                <Link
                  className="program-card"
                  key={p.id}
                  href={`/chuong-trinh/${p.slug}`}
                >
                  <div className="program-number">0{index + 1}</div>
                  <span className="tag">{p.audience}</span>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <span className="card-arrow">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="section schedule-section">
          <div className="container">
            <div className="section-title-row">
              <div>
                <div className="eyebrow">Lớp đang tuyển sinh</div>
                <h2>Chọn lịch phù hợp. Bắt đầu đúng lúc.</h2>
              </div>
              <Link className="text-link" href="/thoi-khoa-bieu">
                Xem toàn bộ lịch <span>→</span>
              </Link>
            </div>
            <div className="schedule-list">
              {classes.rows.length ? (
                classes.rows.map((c) => (
                  <Link
                    className="schedule-item"
                    key={c.id}
                    href={`/lop-hoc/${c.id}`}
                  >
                    <span className="status-dot" />
                    <div>
                      <small>
                        {c.code} · KHỐI {c.grade_min}–{c.grade_max}
                      </small>
                      <strong>{c.name}</strong>
                    </div>
                    <span>{c.sessions}</span>
                    <b>Chi tiết ↗</b>
                  </Link>
                ))
              ) : (
                <div className="empty-state">
                  Lịch khai giảng mới đang được cập nhật.
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="section cta-section">
          <div className="container cta-card">
            <div>
              <span className="eyebrow light">Bắt đầu hành trình</span>
              <h2>Chưa biết lớp nào phù hợp?</h2>
              <p>
                Chia sẻ trình độ và mục tiêu hiện tại. TEDUENGLISH sẽ giúp bạn
                chọn lộ trình phù hợp.
              </p>
            </div>
            <Link className="button light-button" href="/dang-ky-tu-van">
              Đăng ký tư vấn miễn phí <span>→</span>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
