"use client";

import Link from "next/link";
import { firstName } from "@/convex/model";
import { FolderCard, Loading, LoginForm, Swoosh, doneLabel, type DoneMap, type FolderInfo, type QuizMeta, type ResourceRow } from "./parts";
import { useSite, type HomeData } from "./SiteShell";

export default function HomeView() {
  const { home, token } = useSite();
  if (token === undefined || !home) return <Loading />;
  if (home.student && home.dashboard) return <Dashboard home={home} />;
  return <Hero folders={home.folders} />;
}

/** Small label + big text for the grade grid ("Lớp 6", "Chuyên Anh"...). */
function gradeLabel(f: FolderInfo): [string, string] {
  if (/^\d+$/.test(f.badge)) return ["Lớp", f.badge];
  const words = f.name.trim().split(/\s+/);
  if (words.length === 2) return [words[0], words[1]];
  return ["Thư mục", f.badge];
}

function Hero({ folders }: { folders: FolderInfo[] }) {
  const { teacher } = useSite();
  const grades = folders.filter((f) => f.id !== "ielts");
  const ielts = folders.find((f) => f.id === "ielts");
  return (
    <section className="hero view-enter">
      <div className="cover">
        <Swoosh />
        <div>
          <span className="pill">Lớp học thêm · Luyện tập mỗi ngày</span>
          <h1>
            Better English.<span className="hl">Brighter futures.</span>
          </h1>
          <p className="lead">Góc luyện tập tiếng Anh dành riêng cho học sinh TEDU English. Mỗi em một mã, mở đúng bài {teacher} đã giao.</p>
        </div>
        <div className="skill-chips">
          <span>Vocabulary</span>
          <span>Grammar</span>
          <span>Listening</span>
          <span>Reading</span>
          <span>Quizzes</span>
        </div>
      </div>
      <div className="page">
        <div>
          <p className="eyebrow">Student access</p>
          <h2>Nhập mã cá nhân</h2>
          <p className="small muted">Mỗi mã chỉ mở lớp và bài luyện tập được giao cho học sinh đó.</p>
        </div>
        <LoginForm ctx="home" />
        <p className="tiny muted">Không chia sẻ mã cá nhân. Nếu mã không hoạt động, em nhắn {teacher} để được cấp lại.</p>
        <hr className="divider" />
        <div className="stack">
          <div>
            <p style={{ fontWeight: 700 }}>Mở bài theo khối</p>
            <p className="tiny muted">Chọn khối để xem thư mục. Em cần đăng nhập bằng mã cá nhân để làm bài.</p>
          </div>
          <div className="grade-grid">
            {grades.map((f) => {
              const [small, big] = gradeLabel(f);
              return (
                <Link key={f.id} className="grade-link" href={`/thu-muc/${f.id}`}>
                  <span>{small}</span>
                  <b>{big}</b>
                </Link>
              );
            })}
          </div>
          {ielts && (
            <Link className="track-link" href="/thu-muc/ielts">
              <span>
                IELTS · Listening &amp; Reading<small>Bài nghe, đọc có band tham khảo</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function Dashboard({ home }: { home: HomeData }) {
  const { teacher } = useSite();
  const st = home.student!;
  const dash = home.dashboard!;
  const folders = home.folders.filter((f) => dash.openFolders.includes(f.id));
  const done: DoneMap = dash.done;
  const myQuizzes = dash.quizzes;
  const doneCount = myQuizzes.filter((q) => done[q.id]).length;
  const featured = myQuizzes.filter((q) => q.featured);
  const folderName = (id: string) => home.folders.find((f) => f.id === id)?.name ?? "";
  const quizzesIn = (id: string): QuizMeta[] => myQuizzes.filter((q) => q.folder === id);
  const resourcesIn = (id: string): ResourceRow[] => dash.resources.filter((r) => r.folder === id);

  return (
    <>
      <section className="banner view-enter">
        <Swoosh />
        <p className="eyebrow">Welcome back</p>
        <h1>Xin chào, {firstName(st.name)}!</h1>
        <p>Lớp {st.className} · Đây là những nội dung được giao cho em.</p>
        <div className="banner-meta">
          <span>{folders.length} thư mục</span>
          <span>{myQuizzes.length} bài làm trên web</span>
          <span>
            Đã hoàn thành {doneCount}/{myQuizzes.length}
          </span>
        </div>
      </section>

      {featured.length > 0 && (
        <div className="featured">
          {featured.map((q) => {
            const rec = done[q.id];
            if (rec?.locked)
              return (
                <div key={q.id} className="feature-card locked" aria-disabled="true">
                  <div className="ft-text">
                    <p className="eyebrow">{folderName(q.folder)}</p>
                    <h3>{q.title}</h3>
                    <p>Em đã hoàn thành bài này · {doneLabel(rec)}</p>
                  </div>
                  <span className="btn btn-ghost go">✓ Hoàn thành</span>
                </div>
              );
            return (
              <Link key={q.id} className="feature-card" href={`/bai/${q.id}`}>
                <div className="ft-text">
                  <p className="eyebrow">
                    {folderName(q.folder)}
                    {q.ielts ? " · Band tham khảo" : ""}
                  </p>
                  <h3>{q.title}</h3>
                  <p>
                    {q.questionCount} câu{q.minutes ? ` · khoảng ${q.minutes} phút` : ""}
                    {q.subtitle ? ` · ${q.subtitle}` : ""}
                  </p>
                </div>
                <span className={`btn ${rec ? "btn-ghost" : "btn-primary"} go`}>{rec ? (rec.review ? doneLabel(rec) : `Làm lại · ${doneLabel(rec)}`) : "Vào làm bài →"}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <div>
          <p className="eyebrow">My practice</p>
          <h2>Thư mục bài học</h2>
          <p className="small muted">Chọn bài trong thư mục được giao cho em.</p>
        </div>
        <span className="count-chip">{folders.length} thư mục</span>
      </div>
      {folders.length ? (
        <div className={`folder-grid${folders.length % 3 === 0 ? " three" : ""}`}>
          {folders.map((f) => (
            <FolderCard key={f.id} f={f} tone={home.folders.indexOf(f)} quizzes={quizzesIn(f.id)} resources={resourcesIn(f.id)} done={done} />
          ))}
        </div>
      ) : (
        <p className="empty">Mã của em chưa được mở thư mục nào. Em nhắn {teacher} để được giao bài nhé.</p>
      )}
    </>
  );
}
