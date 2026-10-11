"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { firstName, formatBytes } from "@/convex/model";
import { downloadFile, errMsg, safeUrl } from "@/lib/ui";
import { useSite } from "./SiteShell";

type Dashboard = NonNullable<FunctionReturnType<typeof api.site.home>["dashboard"]>;
export type QuizMeta = Dashboard["quizzes"][number];
export type ResourceRow = Dashboard["resources"][number];
export type DoneMap = Dashboard["done"];
export type FolderInfo = { id: string; badge: string; name: string; detail: string };

export const KIND: Record<string, string> = { exercise: "Bài tập", game: "Trò chơi", video: "Video", doc: "Tài liệu" };
export const TONES = ["t1", "", "t2"];

/** The rising arrow from the logo, drawn as a soft arc. */
export function Swoosh() {
  return (
    <svg className="swoosh" viewBox="0 0 600 400" aria-hidden="true" focusable="false">
      <circle cx="470" cy="150" r="120" fill="none" style={{ stroke: "var(--cover-chip)" }} strokeWidth="30" />
      <path d="M10 390 C 200 380, 400 290, 540 80" fill="none" style={{ stroke: "var(--amber-400)" }} strokeOpacity=".45" strokeWidth="12" strokeLinecap="round" />
      <path d="M40 400 C 230 392, 430 305, 566 112" fill="none" style={{ stroke: "var(--sand-200)" }} strokeOpacity=".18" strokeWidth="6" strokeLinecap="round" />
      <path d="M559 52 L550 94 L523 76 Z" style={{ fill: "var(--amber-400)" }} fillOpacity=".85" />
    </svg>
  );
}

export function LoginForm({ ctx }: { ctx: string }) {
  const { settings, signIn, toast } = useSite();
  const login = useMutation(api.site.login);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `code-${ctx}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setErr("Em nhập mã cá nhân trước nhé.");
    setBusy(true);
    try {
      const r = await login({ code });
      if (!r.ok) return setErr(r.error);
      setErr("");
      signIn(r.token);
      toast(`Chào ${firstName(r.name)}! Chúc em học vui.`);
      window.scrollTo(0, 0);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={id}>Mã truy cập</label>
        <input
          className="input"
          id={id}
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={`Nhập mã ${settings.teacher} đã cấp`}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <p className="alert alert-bad" role="alert" hidden={!err}>
        {err}
      </p>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Đang kiểm tra…" : "Vào khu vực học tập"}
      </button>
      {settings.demoCode && (
        <div className="demo-hint">
          <span>
            Mã dùng thử: <code>{settings.demoCode}</code>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              setCode(settings.demoCode);
              document.getElementById(id)?.focus();
            }}
          >
            Điền mã
          </button>
        </div>
      )}
    </form>
  );
}

/** "8/10", or the essay marking state for writing-only quizzes. */
export function doneLabel(rec: DoneMap[string]): string {
  if (rec.review === "done") return rec.total ? `${rec.best}/${rec.total} · Có nhận xét ✓` : "Có nhận xét ✓";
  if (rec.review === "pending") return rec.total ? `${rec.best}/${rec.total} · Chờ nhận xét` : "Đã nộp · chờ nhận xét";
  return `${rec.best}/${rec.total}`;
}

export function QuizButton({ quiz, done }: { quiz: QuizMeta; done: DoneMap }) {
  const rec = done[quiz.id];
  return (
    <Link className={`quiz-btn${rec ? " done" : ""}`} href={`/bai/${quiz.id}`}>
      <span className="q-title">
        {quiz.title}
        {quiz.hasCode && !rec && <span className="lock">· cần mã bài</span>}
      </span>
      <span className="q-meta">{rec ? (rec.review ? doneLabel(rec) : `Đã làm · ${doneLabel(rec)}`) : quiz.hasEssay ? "Bài viết →" : `${quiz.questionCount} câu →`}</span>
    </Link>
  );
}

export function ResourceRowLink({ r }: { r: ResourceRow }) {
  const { docId, openDoc, toast } = useSite();
  if (r.file) {
    const file = r.file;
    return (
      <div className={`res-row res-file${docId === r.id ? " active" : ""}`}>
        <button className="res-main" type="button" onClick={() => openDoc(r.id)}>
          <span className="kind">
            {KIND[r.kind] || "Tài liệu"} · PDF · {formatBytes(file.size)}
          </span>
          <span className="r-title">{r.title}</span>
          {r.description && <span className="r-desc">{r.description}</span>}
        </button>
        <span className="res-actions">
          <button className="btn btn-primary" type="button" onClick={() => openDoc(r.id)}>
            Xem
          </button>
          {file.url && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                toast("Đang tải file về…");
                downloadFile(file.url!, file.name);
              }}
            >
              Tải về
            </button>
          )}
        </span>
      </div>
    );
  }
  return (
    <a className="res-row" href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer">
      <span>
        <span className="kind">{KIND[r.kind] || "Bài học"}</span>
        <span className="r-title">{r.title}</span>
        {r.description && <span className="r-desc">{r.description}</span>}
      </span>
      <span className="arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

export function FolderCard({ f, tone, quizzes, resources, done }: { f: FolderInfo; tone: number; quizzes: QuizMeta[]; resources: ResourceRow[]; done: DoneMap }) {
  const total = quizzes.length + resources.length;
  return (
    <article className="folder">
      <div className="folder-top">
        <span className={`badge ${TONES[tone % 3]}`} aria-hidden="true">
          {f.badge}
        </span>
        <div className="folder-title">
          <h3>
            <Link href={`/thu-muc/${f.id}`}>{f.name}</Link>
          </h3>
          <p>{f.detail}</p>
        </div>
        <span className="count-chip">{total} bài</span>
      </div>
      {quizzes.length > 0 && (
        <div className="quiz-list">
          {quizzes.map((q) => (
            <QuizButton key={q.id} quiz={q} done={done} />
          ))}
        </div>
      )}
      {resources.length > 0 && (
        <div className="res-list">
          {resources.map((r) => (
            <ResourceRowLink key={r.id} r={r} />
          ))}
        </div>
      )}
      {!total && <p className="empty">Chưa có bài được giao trong thư mục này.</p>}
    </article>
  );
}

export function GateLogin({ title, note }: { title: string; note: string }) {
  return (
    <section className="gate">
      <div>
        <p className="eyebrow">Student access</p>
        <h2>{title}</h2>
        <p className="small muted">{note}</p>
      </div>
      <LoginForm ctx="gate" />
    </section>
  );
}

export function GateNoAccess({ name }: { name?: string }) {
  const { teacher } = useSite();
  return (
    <section className="gate">
      <div>
        <p className="eyebrow">Chưa được mở</p>
        <h2>Thư mục này chưa được giao cho em</h2>
        <p className="small muted">
          Mã hiện tại chưa có quyền vào {name || "thư mục này"}. Nếu em cần học nội dung này, hãy nhắn {teacher}.
        </p>
      </div>
      <Link className="btn btn-ghost" href="/">
        Về trang học tập
      </Link>
    </section>
  );
}

export function Missing() {
  return (
    <section className="gate">
      <div>
        <p className="eyebrow">Không tìm thấy</p>
        <h2>Trang này không tồn tại</h2>
        <p className="small muted">Có thể đường link đã cũ hoặc bài đã được đổi tên.</p>
      </div>
      <Link className="btn btn-primary" href="/">
        Về trang học tập
      </Link>
    </section>
  );
}

export function Loading() {
  return <p className="empty" aria-busy="true">Đang tải…</p>;
}
