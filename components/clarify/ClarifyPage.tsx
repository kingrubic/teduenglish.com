"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DONE, MAX_CLARIFY_FILE_BYTES, NOT_DONE, QUESTIONS, type ClarifyQuestion } from "@/convex/clarifyData";
import { formatBytes } from "@/convex/model";
import { Swoosh } from "@/components/site/parts";
import { errMsg, sget, sset, stamp } from "@/lib/ui";

type Answer = NonNullable<FunctionReturnType<typeof api.clarify.answers>>[number];
type Access = { key?: string; adminToken?: string };

const KEY_STORE = "tedu.clarify.key";
const NAME_STORE = "tedu.clarify.name";

export default function ClarifyPage() {
  const [access, setAccess] = useState<Access | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("k") ?? undefined;
    if (fromUrl) sset("localStorage", KEY_STORE, fromUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccess({ key: fromUrl ?? sget<string | undefined>("localStorage", KEY_STORE, undefined), adminToken: sget<string | undefined>("localStorage", "tedu.admin", undefined) });
    setName(sget("localStorage", NAME_STORE, ""));
    document.title = "Câu hỏi cho thầy · TEDU English";
  }, []);

  const answers = useQuery(api.clarify.answers, access ?? "skip");
  const byId = new Map((answers ?? []).map((a) => [a.qid, a]));
  const answered = QUESTIONS.filter((q) => isAnswered(byId.get(q.id))).length;
  const pct = Math.round((answered / QUESTIONS.length) * 100);
  const doneCount = DONE.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="site-cq">
      <div className="shell clarify">
        <header className="site-header">
          <Link className="brand" href="/" aria-label="TEDU English">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-mark" src="/tedu-mark.png" alt="" width={58} height={46} />
            <span className="brand-text">
              <span className="wordmark">
                <span className="a">TEDU</span>
                <span className="b">ENGLISH</span>
              </span>
              <span className="tagline">Trao đổi với thầy</span>
            </span>
          </Link>
          {answers && (
            <span className="count-chip">
              Đã trả lời {answered}/{QUESTIONS.length}
            </span>
          )}
        </header>

        <section className="banner view-enter">
          <Swoosh />
          <p className="eyebrow">Tiến độ dự án · cần thầy xác nhận</p>
          <h1>Web đã làm được gì, còn chờ gì?</h1>
          <p>
            Thầy xem nhanh những phần đã hoàn thành, những phần còn chờ quyết định, rồi trả lời các câu hỏi bên dưới. Câu trả lời <b>tự lưu</b> ngay khi thầy chọn hoặc gõ; thầy có thể
            quay lại sửa bất cứ lúc nào.
          </p>
          <div className="banner-meta">
            <a href="#da-lam">✅ {doneCount} việc đã xong</a>
            <a href="#chua-lam">⏳ {NOT_DONE.length} việc chờ thầy quyết định</a>
            <a href="#cau-hoi">❓ {QUESTIONS.length} câu hỏi</a>
          </div>
        </section>

        {access === null || answers === undefined ? (
          <p className="empty" style={{ marginTop: 18 }}>
            Đang tải…
          </p>
        ) : answers === null ? (
          <section className="gate" style={{ marginInline: "auto" }}>
            <div>
              <p className="eyebrow">Cần link riêng</p>
              <h2>Link chưa đúng hoặc thiếu mã</h2>
              <p className="small muted">Thầy mở đúng đường link đã được gửi (có đoạn “?k=…” ở cuối), hoặc đăng nhập Khu vực giáo viên trên máy này rồi tải lại trang.</p>
            </div>
            <Link className="btn btn-primary" href="/admin">
              Đăng nhập khu vực giáo viên
            </Link>
          </section>
        ) : (
          <>
            <div className="cl-progress">
              <div className="cl-progress-top">
                <b>
                  {answered === QUESTIONS.length ? "Thầy đã trả lời hết, cảm ơn thầy! 🎉" : `Đã trả lời ${answered}/${QUESTIONS.length} câu hỏi`}
                </b>
                <span>{pct}%</span>
              </div>
              <span className="progress" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
              <div className="field cl-name">
                <label htmlFor="cl-name">Người trả lời</label>
                <input
                  className="input compact"
                  id="cl-name"
                  value={name}
                  placeholder="Ví dụ: thầy Toàn"
                  onChange={(e) => {
                    setName(e.target.value);
                    sset("localStorage", NAME_STORE, e.target.value);
                  }}
                />
              </div>
            </div>

            <nav className="cl-tabs" aria-label="Các phần">
              <a href="#da-lam">✅ Đã làm được</a>
              <a href="#chua-lam">⏳ Chưa làm</a>
              <a href="#cau-hoi">❓ Câu hỏi cho thầy</a>
            </nav>

            <section id="da-lam" className="cl-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Đã hoàn thành · đang chạy trên teduenglish.com</p>
                  <h2>Những phần đã làm được</h2>
                </div>
                <span className="count-chip">{doneCount} việc</span>
              </div>
              <div className="cl-done">
                {DONE.map((g) => (
                  <article key={g.area} className="cl-card">
                    <h3>
                      <span aria-hidden="true">{g.icon}</span> {g.area}
                    </h3>
                    <ul>
                      {g.items.map((it) => (
                        <li key={it}>
                          <span className="tick" aria-hidden="true">
                            ✓
                          </span>
                          {it}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section id="chua-lam" className="cl-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Chờ thầy quyết định</p>
                  <h2>Những phần chưa làm</h2>
                  <p className="small muted">Mỗi mục gắn với một câu hỏi. Thầy trả lời xong là mình làm tiếp.</p>
                </div>
                <span className="count-chip">{NOT_DONE.length} việc</span>
              </div>
              <div className="cl-todo">
                {NOT_DONE.map((t) => {
                  const ok = isAnswered(byId.get(t.question));
                  return (
                    <a key={t.title} href={`#q-${t.question}`} className={`cl-card todo${ok ? " ok" : ""}`}>
                      <span className={`status ${ok ? "on" : "draft"}`}>{ok ? "Thầy đã trả lời ✓" : "Chờ thầy quyết định"}</span>
                      <b>{t.title}</b>
                      <span className="small muted">{t.note}</span>
                      <span className="go">{ok ? "Xem câu trả lời →" : "Trả lời câu hỏi →"}</span>
                    </a>
                  );
                })}
              </div>
            </section>

            <section id="cau-hoi" className="cl-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Thầy trả lời trực tiếp · tự lưu</p>
                  <h2>Câu hỏi cho thầy</h2>
                  <p className="small muted">Chọn phương án phù hợp, ghi thêm nếu cần. Câu nào có nút đính kèm, thầy gửi file ngay tại đó.</p>
                </div>
              </div>
              <div className="cl-questions">
                {QUESTIONS.map((q, i) => (
                  <div key={q.id}>
                    {(i === 0 || QUESTIONS[i - 1].group !== q.group) && <h3 className="cl-group">{q.group}</h3>}
                    <QuestionCard q={q} num={i + 1} answer={byId.get(q.id) ?? null} access={access} name={name} />
                  </div>
                ))}
              </div>
            </section>

            <p className="tiny muted" style={{ textAlign: "center", marginTop: 24 }}>
              Mọi câu trả lời được lưu ngay trên hệ thống. Cảm ơn thầy đã dành thời gian!
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function isAnswered(a: Answer | null | undefined) {
  return !!a && (a.choices.length > 0 || a.text.trim() !== "" || a.files.length > 0);
}

function QuestionCard({ q, num, answer, access, name }: { q: ClarifyQuestion; num: number; answer: Answer | null; access: Access; name: string }) {
  const save = useMutation(api.clarify.save);
  const uploadUrl = useMutation(api.clarify.uploadUrl);
  const attach = useMutation(api.clarify.attach);
  const detach = useMutation(api.clarify.detach);
  // Local copy so typing is never interrupted by live updates; seeded from the saved answer.
  const [choices, setChoices] = useState<string[]>(answer?.choices ?? []);
  const [text, setText] = useState(answer?.text ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ choices, text });

  async function persist(next: { choices: string[]; text: string }) {
    latest.current = next;
    setState("saving");
    try {
      await save({ ...access, qid: q.id, choices: next.choices, text: next.text, by: name });
      if (latest.current === next) setState("saved");
    } catch (e) {
      setState("error");
      setErr(errMsg(e, "Chưa lưu được, kiểm tra mạng rồi thử lại."));
    }
  }

  function toggle(opt: string) {
    const next = q.multi ? (choices.includes(opt) ? choices.filter((c) => c !== opt) : [...choices, opt]) : choices[0] === opt ? [] : [opt];
    setChoices(next);
    clearTimeout(timer.current);
    persist({ choices: next, text });
  }

  function onText(v: string) {
    setText(v);
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist({ choices, text: v }), 900);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setErr("");
    for (const file of Array.from(list)) {
      if (file.size > MAX_CLARIFY_FILE_BYTES) {
        setErr(`“${file.name}” quá lớn (tối đa 100 MB).`);
        continue;
      }
      setUploading(file.name);
      try {
        const res = await fetch(await uploadUrl(access), { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error(String(res.status));
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await attach({ ...access, qid: q.id, storageId, name: file.name, by: name });
      } catch (e) {
        setErr(errMsg(e, `Chưa tải được “${file.name}”, thử lại nhé.`));
      }
    }
    setUploading(null);
  }

  const done = choices.length > 0 || text.trim() !== "" || (answer?.files.length ?? 0) > 0;
  return (
    <article className={`cl-q${done ? " answered" : ""}`} id={`q-${q.id}`}>
      <div className="cl-q-head">
        <span className="cl-num">{num}</span>
        <div>
          <h4>{q.title}</h4>
          {q.context && <p className="small muted">{q.context}</p>}
        </div>
      </div>

      {q.options && (
        <div className="checks" role={q.multi ? "group" : "radiogroup"} aria-label={q.title}>
          {q.options.map((opt) => (
            <label className="check" key={opt}>
              <input type={q.multi ? "checkbox" : "radio"} name={`cl-${q.id}`} checked={choices.includes(opt)} onChange={() => toggle(opt)} onClick={() => !q.multi && choices[0] === opt && toggle(opt)} />
              {opt}
            </label>
          ))}
          {q.multi && <span className="tiny muted">(chọn được nhiều)</span>}
        </div>
      )}

      <textarea
        className="textarea prose compact"
        rows={q.options ? 2 : 4}
        value={text}
        placeholder={q.placeholder ?? "Thầy ghi thêm (không bắt buộc)…"}
        onChange={(e) => onText(e.target.value)}
        aria-label={`Ghi chú cho câu ${num}`}
      />

      {q.files && (
        <div className="cl-files">
          {(answer?.files ?? []).map((f) => (
            <span className="cl-file" key={f.storageId}>
              📎{" "}
              <a href={f.url ?? "#"} target="_blank" rel="noopener noreferrer">
                {f.name}
              </a>{" "}
              <span className="muted">· {formatBytes(f.size)}</span>
              <button
                className="link-btn danger"
                type="button"
                aria-label={`Xoá ${f.name}`}
                onClick={() => confirm(`Xoá file “${f.name}”?`) && detach({ ...access, qid: q.id, storageId: f.storageId }).catch((e) => setErr(errMsg(e)))}
              >
                ✕
              </button>
            </span>
          ))}
          <label className="btn btn-ghost btn-sm cl-attach">
            <input type="file" multiple hidden disabled={!!uploading} onChange={(e) => onFiles(e.target.files).finally(() => (e.target.value = ""))} />
            {uploading ? `Đang tải “${uploading}”…` : "📎 Đính kèm file"}
          </label>
          <span className="tiny muted">{q.files}</span>
        </div>
      )}

      <div className="cl-state">
        {state === "saving" && <span className="muted">Đang lưu…</span>}
        {state === "saved" && <span className="ok">✓ Đã lưu</span>}
        {state === "idle" && answer && done && (
          <span className="muted">
            Đã lưu lúc {stamp(answer.updatedAt)}
            {answer.by ? ` · ${answer.by}` : ""}
          </span>
        )}
        {state === "idle" && !done && <span className="muted">Chưa trả lời</span>}
        {err && <span className="bad">{err}</span>}
      </div>
    </article>
  );
}
