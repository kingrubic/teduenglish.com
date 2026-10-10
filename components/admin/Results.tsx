"use client";

import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Rich, stamp } from "@/lib/ui";
import { downloadCsv } from "./csv";
import { Modal, useAdmin, useRun } from "./AdminShell";

export default function Results() {
  const { token } = useAdmin();
  const run = useRun();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const quizId = (params.get("quiz") || undefined) as Id<"quizzes"> | undefined;
  const studentId = (params.get("student") || undefined) as Id<"students"> | undefined;

  const rows = useQuery(api.admin.attempts, { token, quizId, studentId });
  const quizzes = useQuery(api.admin.quizzes, { token });
  const students = useQuery(api.admin.students, { token });
  const del = useMutation(api.admin.deleteAttempt);
  const [cls, setCls] = useState("");
  const [bestOnly, setBestOnly] = useState(false);
  const [detail, setDetail] = useState<Id<"attempts"> | null>(null);

  const classes = useMemo(() => [...new Set((students ?? []).map((s) => s.className))].sort((a, b) => a.localeCompare(b, "vi")), [students]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  let list = (rows ?? []).filter((r) => !cls || r.className === cls);
  if (bestOnly) {
    const best = new Map<string, (typeof list)[number]>();
    for (const r of list) {
      const k = `${r.studentId}|${r.quizId}`;
      const prev = best.get(k);
      if (!prev || r.correct / (r.total || 1) > prev.correct / (prev.total || 1)) best.set(k, r);
    }
    list = list.filter((r) => best.get(`${r.studentId}|${r.quizId}`) === r);
  }
  const avg = list.length ? Math.round((list.reduce((s, r) => s + r.correct / (r.total || 1), 0) / list.length) * 100) : null;

  function exportCsv() {
    downloadCsv(
      "ket-qua-tedu.csv",
      ["Thời gian", "Học sinh", "Lớp", "Bài", "Đúng", "Tổng", "Phần trăm", "Band"],
      list.map((r) => [stamp(r.submittedAt), r.studentName, r.className, r.quizTitle, r.correct, r.total, r.total ? Math.round((r.correct / r.total) * 100) : 0, r.band != null ? r.band.toFixed(1) : ""]),
    );
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Điểm cả lớp</p>
          <h2>Kết quả bài làm</h2>
          <p className="small muted">Mỗi lần học sinh nộp bài là một dòng. Bấm vào dòng để xem em đã trả lời từng câu thế nào.</p>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={exportCsv} disabled={!list.length}>
            Tải CSV
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="filters">
          <select className="select" value={quizId ?? ""} onChange={(e) => setParam("quiz", e.target.value)} aria-label="Lọc theo bài">
            <option value="">Tất cả bài</option>
            {quizzes?.map((q) => (
              <option key={q._id} value={q._id}>
                {q.title}
              </option>
            ))}
          </select>
          <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Lọc theo lớp">
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="select" value={studentId ?? ""} onChange={(e) => setParam("student", e.target.value)} aria-label="Lọc theo học sinh">
            <option value="">Tất cả học sinh</option>
            {students
              ?.filter((s) => !cls || s.className === cls)
              .map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} · {s.className}
                </option>
              ))}
          </select>
          <label className="switch">
            <input type="checkbox" checked={bestOnly} onChange={(e) => setBestOnly(e.target.checked)} />
            Chỉ lần cao nhất
          </label>
        </div>
        <span className="count-chip">
          {list.length} lượt{avg != null ? ` · TB ${avg}%` : ""}
        </span>
      </div>
      {!rows ? (
        <p className="empty">Đang tải…</p>
      ) : !list.length ? (
        <p className="empty">Chưa có kết quả nào khớp bộ lọc.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lúc nộp</th>
                <th>Học sinh</th>
                <th>Bài</th>
                <th className="num">Điểm</th>
                <th>Tỉ lệ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
                return (
                  <tr key={r.id}>
                    <td className="tiny">{stamp(r.submittedAt)}</td>
                    <td>
                      <b>{r.studentName}</b>
                      <span className="sub">{r.className}</span>
                    </td>
                    <td>{r.quizTitle}</td>
                    <td className="num">
                      <b>
                        {r.correct}/{r.total}
                      </b>
                      {r.band != null && <span className="sub">Band {r.band.toFixed(1)}</span>}
                      {r.unanswered > 0 && <span className="sub">{r.unanswered} câu bỏ trống</span>}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      <div className="bar" title={`${pct}%`}>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <span className="sub">{pct}%</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="link-btn" type="button" onClick={() => setDetail(r.id)}>
                          Chi tiết
                        </button>
                        <button
                          className="link-btn danger"
                          type="button"
                          onClick={() => {
                            if (confirm(`Xóa lượt nộp này của ${r.studentName}?`)) run(() => del({ token, id: r.id }), "Đã xóa lượt nộp.");
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {detail && <AttemptDetail id={detail} onClose={() => setDetail(null)} />}
    </section>
  );
}

function AttemptDetail({ id, onClose }: { id: Id<"attempts">; onClose: () => void }) {
  const { token } = useAdmin();
  const a = useQuery(api.admin.attemptDetail, { token, id });
  return (
    <Modal title={a ? `${a.studentName} · ${a.quizTitle}` : "Chi tiết bài làm"} onClose={onClose} wide>
      {!a ? (
        <p className="empty">Đang tải…</p>
      ) : (
        <>
          <p className="small muted">
            {a.className} · nộp lúc {stamp(a.submittedAt)} · <b>{a.correct}/{a.total}</b> đúng
            {a.band != null ? ` · Band ${a.band.toFixed(1)}` : ""}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Câu</th>
                  <th>Câu hỏi</th>
                  <th>Em trả lời</th>
                  <th>Đáp án</th>
                </tr>
              </thead>
              <tbody>
                {a.questions.map((q) => (
                  <tr key={q.num}>
                    <td>
                      {q.num} {q.ok ? <span className="status on">Đúng</span> : <span className="status off">{q.given ? "Sai" : "Bỏ trống"}</span>}
                    </td>
                    <td>
                      <Rich text={q.q} />
                      <span className="sub">{q.section}</span>
                    </td>
                    <td>{q.given ? <Rich text={q.given} /> : <span className="muted">—</span>}</td>
                    <td>
                      <Rich text={q.right} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
