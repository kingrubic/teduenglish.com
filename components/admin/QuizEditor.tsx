"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { slugify, validateSections, type Section } from "@/convex/model";
import { parseLoose } from "@/lib/loose-json";
import { errMsg } from "@/lib/ui";
import { Modal, useAdmin } from "./AdminShell";

/* ---------- editor state ---------- */
let uidSeq = 0;
const uid = () => `u${++uidSeq}`;

type EQ = {
  uid: string;
  type: "mcq" | "fill";
  tag: string;
  q: string;
  options: string[];
  answer: number;
  answerText: string; // fill: accepted answers, one per line
  explain: string;
};
type ES = { uid: string; title: string; kind: "plain" | "listen" | "passage"; media: string; questions: EQ[] };
type Draft = {
  slug: string;
  folder: string;
  title: string;
  subtitle: string;
  minutes: number;
  code: string;
  featured: boolean;
  ielts: "" | "listening" | "reading";
  published: boolean;
  sections: ES[];
};

const blankQ = (type: "mcq" | "fill"): EQ => ({ uid: uid(), type, tag: "", q: "", options: ["", "", "", ""], answer: -1, answerText: "", explain: "" });
const blankS = (): ES => ({ uid: uid(), title: "", kind: "plain", media: "", questions: [blankQ("mcq")] });

function fromSections(sections: Section[]): ES[] {
  return sections.map((s) => ({
    uid: uid(),
    title: s.title,
    kind: s.listen ? "listen" : s.passage ? "passage" : "plain",
    media: s.listen ?? s.passage ?? "",
    questions: s.questions.map((q) =>
      q.type === "mcq"
        ? { uid: uid(), type: "mcq", tag: q.tag ?? "", q: q.q, options: [...q.options], answer: q.answer, answerText: q.options[q.answer] ?? "", explain: q.explain ?? "" }
        : { uid: uid(), type: "fill", tag: q.tag ?? "", q: q.q, options: ["", "", "", ""], answer: -1, answerText: q.answer.join("\n"), explain: q.explain ?? "" },
    ),
  }));
}

function toSections(es: ES[]): Section[] {
  return es.map((s) => ({
    title: s.title,
    ...(s.kind === "listen" ? { listen: s.media } : {}),
    ...(s.kind === "passage" ? { passage: s.media } : {}),
    questions: s.questions.map((q) => {
      const base = { q: q.q, ...(q.tag.trim() ? { tag: q.tag } : {}), ...(q.explain.trim() ? { explain: q.explain } : {}) };
      return q.type === "mcq"
        ? { type: "mcq" as const, ...base, options: q.options, answer: q.answer }
        : { type: "fill" as const, ...base, answer: q.answerText.split("\n").map((x) => x.trim()).filter(Boolean) };
    }),
  }));
}

function fromDoc(d: Doc<"quizzes">): Draft {
  return {
    slug: d.slug,
    folder: d.folder,
    title: d.title,
    subtitle: d.subtitle,
    minutes: d.minutes,
    code: d.code,
    featured: d.featured,
    ielts: d.ielts ?? "",
    published: d.published,
    sections: fromSections(d.sections),
  };
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const a = arr.slice();
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

/* ---------- component ---------- */
export default function QuizEditor({ id }: { id: string }) {
  const isNew = id === "moi";
  const router = useRouter();
  const { token, toast } = useAdmin();
  const doc = useQuery(api.admin.quiz, isNew ? "skip" : { token, id: id as Id<"quizzes"> });
  const folders = useQuery(api.admin.folders, { token });
  const save = useMutation(api.admin.saveQuiz);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  // Initialise once from the loaded quiz (or a blank one).
  useEffect(() => {
    if (draft) return;
    if (isNew && folders) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({ slug: "", folder: folders[0]?.slug ?? "", title: "", subtitle: "", minutes: 10, code: "", featured: false, ielts: "", published: true, sections: [blankS()] });
    } else if (doc) setDraft(fromDoc(doc));
  }, [doc, folders, isNew, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!isNew && doc === null) return <p className="empty">Không tìm thấy bài này.</p>;
  if (!draft || !folders) return <p className="empty">Đang tải…</p>;

  const d = draft;
  const update = (patch: Partial<Draft>) => {
    setDraft({ ...d, ...patch });
    setDirty(true);
  };
  const setSections = (sections: ES[]) => update({ sections });
  const setSection = (si: number, patch: Partial<ES>) => setSections(d.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setQuestion = (si: number, qi: number, patch: Partial<EQ>) =>
    setSection(si, { questions: d.sections[si].questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  const total = d.sections.reduce((n, s) => n + s.questions.length, 0);

  async function onSave() {
    const sections = toSections(d.sections);
    const errs = [...(d.title.trim() ? [] : ["Nhập tên bài."]), ...validateSections(sections)];
    setErrors(errs);
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const r = await save({
        token,
        id: isNew ? undefined : (id as Id<"quizzes">),
        slug: d.slug,
        folder: d.folder,
        title: d.title,
        subtitle: d.subtitle,
        minutes: Number(d.minutes) || 0,
        code: d.code,
        featured: d.featured,
        ielts: d.ielts || undefined,
        published: d.published,
        sections,
      });
      setDirty(false);
      setDraft({ ...d, slug: r.slug });
      toast("Đã lưu bài.");
      if (isNew) router.replace(`/admin/bai-lam/${r.id}`);
    } catch (e) {
      setErrors(errMsg(e).split("\n"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="q-editor">
      <Link className="back-link" href="/admin/bai-lam">
        ← Danh sách bài
      </Link>

      <section className="panel">
        <div className="toolbar">
          <div>
            <p className="eyebrow">{isNew ? "Soạn bài mới" : "Sửa bài"}</p>
            <h2>{d.title || "Bài chưa đặt tên"}</h2>
          </div>
          <div className="actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setJsonOpen(true)}>
              Nhập / xuất JSON
            </button>
            {!isNew && (
              <a className="btn btn-ghost btn-sm" href={`/bai/${d.slug}`} target="_blank" rel="noopener noreferrer">
                Xem như học sinh ↗
              </a>
            )}
          </div>
        </div>
        {errors.length > 0 && (
          <div className="alert alert-bad" role="alert">
            {errors.slice(0, 8).join("\n")}
            {errors.length > 8 ? `\n… và ${errors.length - 8} lỗi khác` : ""}
          </div>
        )}
        <div className="row-2">
          <div className="field">
            <label htmlFor="qz-title">Tên bài</label>
            <input
              className="input"
              id="qz-title"
              value={d.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Trắc nghiệm Unit 4–5"
            />
          </div>
          <div className="field">
            <label htmlFor="qz-sub">
              Mô tả ngắn <span className="hint">(không bắt buộc)</span>
            </label>
            <input className="input" id="qz-sub" value={d.subtitle} onChange={(e) => update({ subtitle: e.target.value })} placeholder="Vocabulary · Grammar" />
          </div>
        </div>
        <div className="row-3">
          <div className="field">
            <label htmlFor="qz-folder">Thư mục</label>
            <select className="select" id="qz-folder" value={d.folder} onChange={(e) => update({ folder: e.target.value })}>
              {folders.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="qz-min">Thời gian gợi ý (phút)</label>
            <input className="input" id="qz-min" type="number" min={0} max={300} value={d.minutes} onChange={(e) => update({ minutes: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="qz-code">
              Mã bài <span className="hint">(để trống nếu không cần)</span>
            </label>
            <input className="input mono" id="qz-code" value={d.code} onChange={(e) => update({ code: e.target.value })} placeholder="TS10" autoCapitalize="off" spellCheck={false} />
          </div>
        </div>
        <div className="row-3">
          <div className="field">
            <label htmlFor="qz-ielts">Band IELTS tham khảo</label>
            <select className="select" id="qz-ielts" value={d.ielts} onChange={(e) => update({ ielts: e.target.value as Draft["ielts"] })}>
              <option value="">Không hiện band</option>
              <option value="listening">IELTS Listening</option>
              <option value="reading">IELTS Reading</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="qz-slug">
              Đường link <span className="hint">(/bai/…)</span>
            </label>
            <input className="input mono" id="qz-slug" value={d.slug} onChange={(e) => update({ slug: e.target.value })} placeholder={slugify(d.title) || "gs8-unit-4"} autoCapitalize="off" spellCheck={false} />
          </div>
          <div className="field" style={{ justifyContent: "flex-end", gap: 10 }}>
            <label className="switch">
              <input type="checkbox" checked={d.published} onChange={(e) => update({ published: e.target.checked })} />
              Hiện cho học sinh
            </label>
            <label className="switch">
              <input type="checkbox" checked={d.featured} onChange={(e) => update({ featured: e.target.checked })} />
              Nổi bật đầu trang học sinh
            </label>
          </div>
        </div>
      </section>

      {d.sections.map((s, si) => (
        <section className="sec-edit" key={s.uid}>
          <div className="sec-head">
            <b className="eyebrow">
              Phần {si + 1} · {s.questions.length} câu
            </b>
            <div className="row-actions">
              <button className="link-btn" type="button" disabled={si === 0} onClick={() => setSections(move(d.sections, si, -1))}>
                ↑ Lên
              </button>
              <button className="link-btn" type="button" disabled={si === d.sections.length - 1} onClick={() => setSections(move(d.sections, si, 1))}>
                ↓ Xuống
              </button>
              <button
                className="link-btn danger"
                type="button"
                disabled={d.sections.length === 1}
                onClick={() => confirm(`Xóa phần ${si + 1} và ${s.questions.length} câu hỏi?`) && setSections(d.sections.filter((_, i) => i !== si))}
              >
                Xóa phần
              </button>
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor={`s-title-${s.uid}`}>Tiêu đề phần</label>
              <input className="input compact" id={`s-title-${s.uid}`} value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} placeholder="Vocabulary & Grammar" />
            </div>
            <div className="field">
              <label htmlFor={`s-kind-${s.uid}`}>Dạng phần</label>
              <select className="select compact" id={`s-kind-${s.uid}`} value={s.kind} onChange={(e) => setSection(si, { kind: e.target.value as ES["kind"] })}>
                <option value="plain">Câu hỏi thường</option>
                <option value="listen">Nghe (máy đọc lời thoại)</option>
                <option value="passage">Đọc hiểu (có bài đọc)</option>
              </select>
            </div>
          </div>
          {s.kind !== "plain" && (
            <div className="field">
              <label htmlFor={`s-media-${s.uid}`}>
                {s.kind === "listen" ? "Lời thoại" : "Bài đọc"}{" "}
                <span className="hint">
                  {s.kind === "listen"
                    ? "— mỗi dòng một câu, dạng “Tên: lời nói”; mỗi người một giọng. Học sinh xem được lời thoại sau khi nộp."
                    : "— dòng đầu là tiêu đề, để trống một dòng rồi viết các đoạn."}
                </span>
              </label>
              <textarea className="textarea prose" id={`s-media-${s.uid}`} rows={8} value={s.media} onChange={(e) => setSection(si, { media: e.target.value })} />
            </div>
          )}

          {s.questions.map((q, qi) => (
            <div className="qe" key={q.uid}>
              <div className="qe-head">
                <b>Câu {qi + 1}</b>
                <div className="row-actions">
                  <select
                    className="select compact"
                    style={{ width: "auto" }}
                    value={q.type}
                    aria-label="Dạng câu hỏi"
                    onChange={(e) => {
                      const type = e.target.value as EQ["type"];
                      if (type === "fill" && q.type === "mcq" && !q.answerText && q.options[q.answer]) setQuestion(si, qi, { type, answerText: q.options[q.answer] });
                      else setQuestion(si, qi, { type });
                    }}
                  >
                    <option value="mcq">Trắc nghiệm</option>
                    <option value="fill">Điền từ / viết lại câu</option>
                  </select>
                  <button className="link-btn" type="button" disabled={qi === 0} onClick={() => setSection(si, { questions: move(s.questions, qi, -1) })} aria-label="Lên">
                    ↑
                  </button>
                  <button className="link-btn" type="button" disabled={qi === s.questions.length - 1} onClick={() => setSection(si, { questions: move(s.questions, qi, 1) })} aria-label="Xuống">
                    ↓
                  </button>
                  <button
                    className="link-btn"
                    type="button"
                    onClick={() => setSection(si, { questions: [...s.questions.slice(0, qi + 1), { ...q, uid: uid(), options: [...q.options] }, ...s.questions.slice(qi + 1)] })}
                  >
                    Nhân bản
                  </button>
                  <button className="link-btn danger" type="button" disabled={s.questions.length === 1} onClick={() => setSection(si, { questions: s.questions.filter((_, i) => i !== qi) })}>
                    Xóa
                  </button>
                </div>
              </div>
              <div className="row-2" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,1fr)" }}>
                <div className="field">
                  <label htmlFor={`q-${q.uid}`}>
                    Câu hỏi <span className="hint">— dùng ___ cho chỗ trống, [u]chữ[/u] để gạch chân, [b]chữ[/b] in đậm</span>
                  </label>
                  <textarea className="textarea prose compact" id={`q-${q.uid}`} rows={2} style={{ minHeight: 0 }} value={q.q} onChange={(e) => setQuestion(si, qi, { q: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`tag-${q.uid}`}>
                    Nhãn <span className="hint">(tuỳ chọn)</span>
                  </label>
                  <input className="input compact" id={`tag-${q.uid}`} value={q.tag} onChange={(e) => setQuestion(si, qi, { tag: e.target.value })} placeholder="Unit 1" />
                </div>
              </div>
              {q.type === "mcq" ? (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="tiny muted">Các lựa chọn — chọn nút tròn ở đáp án đúng:</span>
                  {q.options.map((o, oi) => (
                    <div className="opt-edit" key={oi}>
                      <input type="radio" name={`ans-${q.uid}`} checked={q.answer === oi} onChange={() => setQuestion(si, qi, { answer: oi })} aria-label={`Đáp án đúng là ${String.fromCharCode(65 + oi)}`} />
                      <span className="letter">{String.fromCharCode(65 + oi)}</span>
                      <input
                        className="input compact"
                        value={o}
                        onChange={(e) => setQuestion(si, qi, { options: q.options.map((x, i) => (i === oi ? e.target.value : x)) })}
                        aria-label={`Lựa chọn ${String.fromCharCode(65 + oi)}`}
                      />
                      <button
                        className="link-btn danger"
                        type="button"
                        disabled={q.options.length <= 2}
                        onClick={() =>
                          setQuestion(si, qi, {
                            options: q.options.filter((_, i) => i !== oi),
                            answer: q.answer === oi ? -1 : q.answer > oi ? q.answer - 1 : q.answer,
                          })
                        }
                        aria-label="Bỏ lựa chọn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="row-actions">
                    {q.options.length < 6 && (
                      <button className="link-btn" type="button" onClick={() => setQuestion(si, qi, { options: [...q.options, ""] })}>
                        + Thêm lựa chọn
                      </button>
                    )}
                    <button className="link-btn" type="button" onClick={() => setQuestion(si, qi, { options: ["True", "False", "Not Given"], answer: -1 })}>
                      Dùng True / False / Not Given
                    </button>
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor={`fa-${q.uid}`}>
                    Đáp án được chấp nhận <span className="hint">— mỗi dòng một cách viết đúng; không phân biệt hoa/thường</span>
                  </label>
                  <textarea className="textarea compact" id={`fa-${q.uid}`} rows={2} style={{ minHeight: 0 }} value={q.answerText} onChange={(e) => setQuestion(si, qi, { answerText: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label htmlFor={`ex-${q.uid}`}>
                  Giải thích <span className="hint">(hiện sau khi nộp)</span>
                </label>
                <input className="input compact" id={`ex-${q.uid}`} value={q.explain} onChange={(e) => setQuestion(si, qi, { explain: e.target.value })} />
              </div>
            </div>
          ))}
          <div className="row-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSection(si, { questions: [...s.questions, blankQ("mcq")] })}>
              + Câu trắc nghiệm
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSection(si, { questions: [...s.questions, blankQ("fill")] })}>
              + Câu điền từ
            </button>
          </div>
        </section>
      ))}

      <div>
        <button className="btn btn-ghost" type="button" onClick={() => setSections([...d.sections, blankS()])}>
          + Thêm phần mới
        </button>
      </div>

      <div className="editor-bar">
        <span className="small muted">
          {d.sections.length} phần · {total} câu{dirty ? " · có thay đổi chưa lưu" : ""}
        </span>
        <div className="row-actions">
          <Link className="btn btn-ghost btn-sm" href="/admin/bai-lam">
            Đóng
          </Link>
          <button className="btn btn-primary btn-sm" type="button" onClick={onSave} disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu bài"}
          </button>
        </div>
      </div>

      {jsonOpen && (
        <JsonDialog
          draft={d}
          onClose={() => setJsonOpen(false)}
          onApply={(next) => {
            update(next);
            setJsonOpen(false);
            toast("Đã nạp nội dung. Kiểm tra rồi bấm Lưu bài.");
          }}
        />
      )}
    </div>
  );
}

function JsonDialog({ draft, onClose, onApply }: { draft: Draft; onClose: () => void; onApply: (d: Partial<Draft>) => void }) {
  const exported = JSON.stringify(
    {
      id: draft.slug,
      folder: draft.folder,
      title: draft.title,
      subtitle: draft.subtitle,
      minutes: draft.minutes,
      code: draft.code,
      featured: draft.featured,
      ...(draft.ielts ? { ielts: draft.ielts } : {}),
      sections: toSections(draft.sections),
    },
    null,
    2,
  );
  const [text, setText] = useState(exported);
  const [err, setErr] = useState("");

  function apply() {
    try {
      const raw = parseLoose(text) as Record<string, unknown> | unknown[];
      const obj = (Array.isArray(raw) ? { sections: raw } : raw) as Record<string, unknown>;
      if (!Array.isArray(obj.sections)) throw new Error("Thiếu mục sections.");
      const sections = (obj.sections as Record<string, unknown>[]).map((s) => ({
        title: String(s.title ?? ""),
        ...(s.listen ? { listen: String(s.listen) } : {}),
        ...(s.passage ? { passage: String(s.passage) } : {}),
        questions: ((s.questions as Record<string, unknown>[]) ?? []).map((q) =>
          q.type === "fill"
            ? { type: "fill" as const, tag: q.tag ? String(q.tag) : undefined, q: String(q.q ?? ""), answer: (Array.isArray(q.answer) ? q.answer : [q.answer]).map(String), explain: q.explain ? String(q.explain) : undefined }
            : { type: "mcq" as const, tag: q.tag ? String(q.tag) : undefined, q: String(q.q ?? ""), options: ((q.options as unknown[]) ?? []).map(String), answer: Number(q.answer), explain: q.explain ? String(q.explain) : undefined },
        ),
      }));
      const patch: Partial<Draft> = { sections: fromSections(sections) };
      if (typeof obj.title === "string") patch.title = obj.title;
      if (typeof obj.subtitle === "string") patch.subtitle = obj.subtitle;
      if (typeof obj.minutes === "number") patch.minutes = obj.minutes;
      if (typeof obj.code === "string") patch.code = obj.code;
      if (typeof obj.featured === "boolean") patch.featured = obj.featured;
      if (obj.ielts === "listening" || obj.ielts === "reading") patch.ielts = obj.ielts;
      if (typeof obj.id === "string" && !draft.slug) patch.slug = obj.id;
      onApply(patch);
    } catch (e) {
      setErr(`Không đọc được nội dung: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <Modal title="Nhập / xuất JSON" onClose={onClose} wide>
      <p className="small muted">
        Dán một bài theo định dạng của file <code>data.js</code> cũ (một mục trong <code>quizzes</code>) hoặc JSON. Nội dung hiện tại của bài đang hiện sẵn bên dưới để sao chép.
      </p>
      <textarea className="textarea" rows={18} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <p className="alert alert-bad" role="alert" hidden={!err}>
        {err}
      </p>
      <div className="modal-foot">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn-primary" type="button" onClick={apply}>
          Nạp vào trình soạn
        </button>
      </div>
    </Modal>
  );
}
