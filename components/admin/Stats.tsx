"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { maskedName, percent, rankBy } from "@/convex/model";
import { downloadXlsx } from "@/lib/excel";
import { useAdmin } from "./AdminShell";

const SKILL_LABEL: Record<string, string> = { listening: "Listening", reading: "Reading", writing: "Writing" };
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Stats() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "xep-hang" ? "rank" : "attendance";
  const go = (t: string) => router.replace(`${pathname}${t === "rank" ? "?tab=xep-hang" : ""}`);

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Tự động cập nhật theo bài học sinh nộp</p>
          <h2>Thống kê học tập</h2>
        </div>
      </div>
      <div className="checks" role="tablist" aria-label="Loại thống kê">
        <button className={`check${tab === "attendance" ? " on-tab" : ""}`} role="tab" aria-selected={tab === "attendance"} type="button" onClick={() => go("attendance")}>
          📅 Chuyên cần
        </button>
        <button className={`check${tab === "rank" ? " on-tab" : ""}`} role="tab" aria-selected={tab === "rank"} type="button" onClick={() => go("rank")}>
          🏆 Xếp hạng IELTS
        </button>
      </div>
      {tab === "rank" ? <Ranking /> : <Attendance />}
    </section>
  );
}

/* ======================= attendance ======================= */

function Attendance() {
  const { token } = useAdmin();
  const rows = useQuery(api.stats.attendance, { token });
  const [cls, setCls] = useState("");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState<"rate" | "name">("rate");

  const classes = useMemo(() => [...new Set((rows ?? []).map((r) => r.className))].sort((a, b) => a.localeCompare(b, "vi")), [rows]);
  const folders = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => r.byFolder.forEach((f) => m.set(f.id, f.name)));
    return [...m];
  }, [rows]);

  const list = (rows ?? [])
    .filter((r) => !cls || r.className === cls)
    .map((r) => {
      const f = folder ? r.byFolder.find((x) => x.id === folder) : null;
      const done = folder ? (f?.done ?? 0) : r.done;
      const total = folder ? (f?.total ?? 0) : r.total;
      return { ...r, d: done, t: total, pct: percent(done, total) };
    })
    .filter((r) => r.t > 0)
    .sort((a, b) => (sort === "rate" ? b.pct - a.pct || a.name.localeCompare(b.name, "vi") : a.name.localeCompare(b.name, "vi")));

  const avg = list.length ? Math.round(list.reduce((s, r) => s + r.pct, 0) / list.length) : 0;

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Lớp">
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Thư mục">
            <option value="">Tất cả thư mục được giao</option>
            {folders.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as "rate" | "name")} aria-label="Sắp xếp">
            <option value="rate">Chuyên cần cao → thấp</option>
            <option value="name">Theo tên</option>
          </select>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={!list.length}
          onClick={() =>
            downloadXlsx(
              "chuyen-can.xlsx",
              ["Học sinh", "Lớp", "Đã làm", "Chưa làm", "Tổng bài", "Chuyên cần (%)"],
              list.map((r) => [r.name, r.className, r.d, r.t - r.d, r.t, r.pct]),
            )
          }
        >
          Tải Excel
        </button>
      </div>

      {!rows ? (
        <p className="empty">Đang tải…</p>
      ) : !list.length ? (
        <p className="empty">Chưa có học sinh nào được giao bài làm trên web ở bộ lọc này.</p>
      ) : (
        <>
          <div className="stats-row" style={{ marginTop: 0 }}>
            <div className="stat-tile">
              <b>{avg}%</b>
              <span>chuyên cần trung bình</span>
            </div>
            <div className="stat-tile">
              <b>{list.filter((r) => r.pct >= 80).length}</b>
              <span>em từ 80% trở lên</span>
            </div>
            <div className="stat-tile">
              <b>{list.filter((r) => r.pct < 50).length}</b>
              <span>em dưới 50%</span>
            </div>
            <div className="stat-tile">
              <b>{list.length}</b>
              <span>học sinh</span>
            </div>
          </div>
          <p className="tiny muted">
            Tỷ lệ = số bài làm trên web em đã nộp ít nhất một lần / tổng số bài đang hiện trong các thư mục được giao cho em. Tài liệu, PDF không tính.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  {!folder && <th>Theo thư mục</th>}
                  <th className="num">Đã làm</th>
                  <th className="num">Chưa làm</th>
                  <th>Chuyên cần</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td>{r.className}</td>
                    {!folder && (
                      <td>
                        {r.byFolder.map((f) => (
                          <span key={f.id} className="tag">
                            {f.name.replace("Global Success", "GS")} {f.done}/{f.total}
                          </span>
                        ))}
                      </td>
                    )}
                    <td className="num">{r.d}</td>
                    <td className="num">{r.t - r.d}</td>
                    <td style={{ minWidth: 140 }}>
                      <div className={`bar${r.pct >= 80 ? " good" : r.pct < 50 ? " low" : ""}`}>
                        <i style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="sub">
                        <b>{r.pct}%</b> · {r.d}/{r.t} bài
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ======================= IELTS ranking ======================= */

function Ranking() {
  const { token } = useAdmin();
  const data = useQuery(api.stats.leaderboard, { token });
  const [cls, setCls] = useState("");
  const [skill, setSkill] = useState("");
  const [test, setTest] = useState("");
  const [mask, setMask] = useState(false);

  const classes = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.className))].sort((a, b) => a.localeCompare(b, "vi")), [data]);
  const skillTests = (data?.tests ?? []).filter((t) => !skill || t.skill === skill);
  const inClass = (data?.rows ?? []).filter((r) => !cls || r.className === cls);
  // Only tests someone in the current selection has a band for.
  const shown = (test ? skillTests.filter((t) => t.id === test) : skillTests).filter((t) => inClass.some((r) => r.scores[t.id] != null));

  const ranked = rankBy(
    inClass
      .map((r) => {
        const vals = shown.map((t) => r.scores[t.id]).filter((x): x is number => x != null);
        return { ...r, count: vals.length, avg: vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0 };
      })
      .filter((r) => r.count > 0),
    (r) => Math.round(r.avg * 100),
  );
  const label = (r: { name: string; code: string }) => (mask ? maskedName(r.code) : r.name);

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Lớp">
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="select"
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value);
              setTest("");
            }}
            aria-label="Kỹ năng"
          >
            <option value="">Cả 3 kỹ năng</option>
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
            <option value="writing">Writing</option>
          </select>
          <select className="select" value={test} onChange={(e) => setTest(e.target.value)} aria-label="Bài kiểm tra">
            <option value="">Tất cả bài {skill ? SKILL_LABEL[skill] : "IELTS"}</option>
            {skillTests.map((t) => (
              <option key={t.id} value={t.id}>
                {SKILL_LABEL[t.skill]} · {t.title}
              </option>
            ))}
          </select>
          <label className="switch">
            <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
            Ẩn tên (Xxxxx0789)
          </label>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={!ranked.length}
          onClick={() =>
            downloadXlsx(
              "xep-hang-ielts.xlsx",
              ["Xếp hạng", "Học sinh", "Lớp", ...shown.map((t) => `${SKILL_LABEL[t.skill]} · ${t.title}`), ...(shown.length > 1 ? ["Trung bình"] : [])],
              ranked.map(({ item: r, rank }) => [
                rank,
                label(r),
                r.className,
                ...shown.map((t) => (r.scores[t.id] != null ? r.scores[t.id].toFixed(1) : "")),
                ...(shown.length > 1 ? [r.avg.toFixed(1)] : []),
              ]),
            )
          }
        >
          Tải Excel
        </button>
      </div>
      <p className="tiny muted">
        Lấy band cao nhất của mỗi em ở từng bài. Listening/Reading: band quy đổi tự động. Writing: band thầy cô chấm; bài có Task 1 và Task 2 tính (Task 1 + 2 × Task 2) / 3, chỉ tính khi đã chấm
        đủ cả hai. {shown.length > 1 ? "Xếp theo band trung bình của các bài em đã làm." : ""}
      </p>
      {!data ? (
        <p className="empty">Đang tải…</p>
      ) : !data.tests.length ? (
        <p className="empty">Chưa có bài IELTS nào. Chọn “Kỹ năng IELTS” trong trình soạn bài để bài được xếp hạng.</p>
      ) : !ranked.length ? (
        <p className="empty">Chưa có học sinh nào có điểm ở bộ lọc này.</p>
      ) : (
        <div className="table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th className="num">Hạng</th>
                <th>Học sinh</th>
                <th>Lớp</th>
                {shown.map((t) => (
                  <th key={t.id} className="num" title={t.title}>
                    {SKILL_LABEL[t.skill]}
                    <span className="sub" style={{ textTransform: "none", letterSpacing: 0 }}>
                      {t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title}
                    </span>
                  </th>
                ))}
                {shown.length > 1 && <th className="num">Trung bình</th>}
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ item: r, rank }) => (
                <tr key={r.id} className={rank <= 3 ? "top" : ""}>
                  <td className="num">
                    <b>{MEDAL[rank - 1] ?? rank}</b>
                  </td>
                  <td>
                    <b className={mask ? "mono" : ""}>{label(r)}</b>
                  </td>
                  <td>{r.className}</td>
                  {shown.map((t) => (
                    <td key={t.id} className="num">
                      {r.scores[t.id] != null ? r.scores[t.id].toFixed(1) : <span className="muted">—</span>}
                    </td>
                  ))}
                  {shown.length > 1 && (
                    <td className="num">
                      <b>{r.avg.toFixed(1)}</b>
                      <span className="sub">{r.count} bài</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
