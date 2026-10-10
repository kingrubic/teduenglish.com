"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { signalReady } from "@/lib/ui";
import { GateLogin, GateNoAccess, Loading, Missing, QuizButton, ResourceRowLink, Swoosh } from "./parts";
import { useSite } from "./SiteShell";

export default function FolderView({ id }: { id: string }) {
  const { token } = useSite();
  const data = useQuery(api.site.folder, token === undefined ? "skip" : { token: token ?? undefined, id });

  useEffect(() => {
    if (data !== undefined) signalReady();
  }, [data]);

  if (data === undefined) return <Loading />;
  if (data === null) return <Missing />;
  const f = data.folder;

  return (
    <>
      <Link className="back-link" href="/">
        ← Trang học tập
      </Link>
      <section className="banner view-enter">
        <Swoosh />
        <p className="eyebrow">Thư mục bài học</p>
        <h1>{f.name}</h1>
        <p>{f.detail}</p>
        <div className="banner-meta">
          <span>{f.quizCount} bài làm trên web</span>
          <span>{f.resourceCount} tài liệu &amp; liên kết</span>
        </div>
      </section>
      {data.status === "login" && <GateLogin title="Đăng nhập để mở thư mục" note={`Nhập mã cá nhân để xem bài được giao trong ${f.name}.`} />}
      {data.status === "noaccess" && <GateNoAccess name={f.name} />}
      {data.status === "ok" && (
        <div className="t-grid two">
          <section className="panel">
            <div>
              <p className="eyebrow">Làm trên web · chấm tự động</p>
              <h2>Bài luyện tập</h2>
            </div>
            {data.quizzes.length ? (
              <div className="quiz-list">
                {data.quizzes.map((q) => (
                  <QuizButton key={q.id} quiz={q} done={data.done} />
                ))}
              </div>
            ) : (
              <p className="empty">Chưa có bài làm trên web trong thư mục này.</p>
            )}
          </section>
          <section className="panel">
            <div>
              <p className="eyebrow">Mở trong tab mới</p>
              <h2>Tài liệu &amp; liên kết</h2>
            </div>
            {data.resources.length ? (
              <div className="res-list">
                {data.resources.map((r) => (
                  <ResourceRowLink key={r.id} r={r} />
                ))}
              </div>
            ) : (
              <p className="empty">Chưa có tài liệu nào được thêm.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
