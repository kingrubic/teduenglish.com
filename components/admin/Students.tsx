"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { noMarks } from "@/convex/model";
import { copyText, errMsg, stamp } from "@/lib/ui";
import { downloadCsv } from "./csv";
import { Modal, useAdmin, useRun } from "./AdminShell";

type Student = FunctionReturnType<typeof api.admin.students>[number];
type Folder = FunctionReturnType<typeof api.admin.folders>[number];

export default function Students() {
  const { token, toast } = useAdmin();
  const run = useRun();
  const students = useQuery(api.admin.students, { token });
  const folders = useQuery(api.admin.folders, { token });
  const regen = useMutation(api.admin.regenerateCode);
  const del = useMutation(api.admin.deleteStudent);
  const setFolders = useMutation(api.admin.setStudentsFolders);

  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState<"" | "on" | "off">("");
  const [selected, setSelected] = useState<Set<Id<"students">>>(new Set());
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkFolder, setBulkFolder] = useState("");

  const classes = useMemo(() => [...new Set((students ?? []).map((s) => s.className))].sort((a, b) => a.localeCompare(b, "vi")), [students]);
  const folderName = useMemo(() => new Map((folders ?? []).map((f) => [f.slug, f.name])), [folders]);

  const list = (students ?? []).filter((s) => {
    const needle = noMarks(q).toLowerCase().trim();
    if (needle && !noMarks(`${s.name} ${s.code} ${s.className}`).toLowerCase().includes(needle)) return false;
    if (cls && s.className !== cls) return false;
    if (folder && !(s.folders.includes(folder) || s.folders.includes("*"))) return false;
    if (status === "on" && !s.active) return false;
    if (status === "off" && s.active) return false;
    return true;
  });
  const allSelected = list.length > 0 && list.every((s) => selected.has(s._id));

  function toggle(id: Id<"students">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportList() {
    downloadCsv(
      `hoc-sinh${cls ? "-" + cls : ""}.csv`,
      ["Họ tên", "Lớp", "Mã", "Thư mục", "Trạng thái"],
      list.map((s) => [s.name, s.className, s.code, s.folders.map((f) => (f === "*" ? "Tất cả" : folderName.get(f) ?? f)).join("; "), s.active ? "Đang mở" : "Đã khóa"]),
    );
  }

  function copyCodes() {
    const text = list.filter((s) => s.active).map((s) => `${s.name} (${s.className}): ${s.code}`).join("\n");
    copyText(text, () => toast(`Đã sao chép mã của ${list.filter((s) => s.active).length} học sinh.`), () => toast("Trình duyệt chặn sao chép. Dùng nút Tải CSV."));
  }

  async function bulkFolderAction(add: boolean) {
    if (!bulkFolder || !selected.size) return;
    await run(() => setFolders({ token, ids: [...selected], folder: bulkFolder, add }), add ? "Đã mở thư mục cho các em đã chọn." : "Đã bỏ thư mục khỏi các em đã chọn.");
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Mã truy cập</p>
          <h2>Học sinh</h2>
          <p className="small muted">Mỗi em một mã cá nhân. Khóa mã hoặc đổi mã sẽ đăng xuất em đó trên mọi thiết bị.</p>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setBulk(true)} disabled={!folders}>
            Thêm nhiều học sinh
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setEditing("new")} disabled={!folders}>
            + Thêm học sinh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input className="input" type="search" placeholder="Tìm tên, mã, lớp…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm học sinh" />
          <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Lọc theo lớp">
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Lọc theo thư mục">
            <option value="">Mọi thư mục</option>
            {folders?.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as "" | "on" | "off")} aria-label="Lọc theo trạng thái">
            <option value="">Mọi trạng thái</option>
            <option value="on">Đang mở</option>
            <option value="off">Đã khóa</option>
          </select>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={copyCodes} disabled={!list.length}>
            Sao chép mã
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={exportList} disabled={!list.length}>
            Tải CSV
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="toolbar alert alert-good">
          <span>Đã chọn {selected.size} học sinh</span>
          <div className="filters" style={{ flex: "0 1 auto" }}>
            <select className="select compact" value={bulkFolder} onChange={(e) => setBulkFolder(e.target.value)} aria-label="Thư mục">
              <option value="">Chọn thư mục…</option>
              {folders?.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" type="button" disabled={!bulkFolder} onClick={() => bulkFolderAction(true)}>
              Mở thư mục
            </button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={!bulkFolder} onClick={() => bulkFolderAction(false)}>
              Bỏ thư mục
            </button>
            <button className="link-btn" type="button" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {!students ? (
        <p className="empty">Đang tải…</p>
      ) : !list.length ? (
        <p className="empty">{students.length ? "Không có học sinh khớp bộ lọc." : "Chưa có học sinh nào. Bấm “Thêm nhiều học sinh” để dán danh sách lớp."}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((s) => s._id)))}
                  />
                </th>
                <th>Họ tên</th>
                <th>Lớp</th>
                <th>Mã</th>
                <th>Thư mục</th>
                <th className="num">Bài đã nộp</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s._id} className={s.active ? "" : "is-off"}>
                  <td>
                    <input type="checkbox" aria-label={`Chọn ${s.name}`} checked={selected.has(s._id)} onChange={() => toggle(s._id)} />
                  </td>
                  <td>
                    <b>{s.name}</b>
                    {s.note && <span className="sub">{s.note}</span>}
                  </td>
                  <td>{s.className}</td>
                  <td>
                    <code>{s.code}</code>
                  </td>
                  <td>
                    {s.folders.length ? (
                      s.folders.map((f) => (
                        <span key={f} className="tag">
                          {f === "*" ? "Tất cả" : folderName.get(f) ?? f}
                        </span>
                      ))
                    ) : (
                      <span className="muted tiny">Chưa mở</span>
                    )}
                  </td>
                  <td className="num">
                    {s.attemptCount ? <Link href={`/admin/ket-qua?student=${s._id}`}>{s.attemptCount}</Link> : 0}
                    {s.lastAttemptAt && <span className="sub">{stamp(s.lastAttemptAt)}</span>}
                  </td>
                  <td>{s.active ? <span className="status on">Đang mở</span> : <span className="status off">Đã khóa</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="link-btn" type="button" onClick={() => setEditing(s)}>
                        Sửa
                      </button>
                      <button
                        className="link-btn"
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Tạo mã mới cho ${s.name}? Mã cũ "${s.code}" sẽ không dùng được nữa.`)) return;
                          const code = await run(() => regen({ token, id: s._id }));
                          if (code) toast(`Mã mới của ${s.name}: ${code}`);
                        }}
                      >
                        Đổi mã
                      </button>
                      <button
                        className="link-btn danger"
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa học sinh ${s.name} và toàn bộ kết quả bài làm của em?`)) run(() => del({ token, id: s._id }), "Đã xóa học sinh.");
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && folders && <StudentForm student={editing === "new" ? null : editing} folders={folders} classes={classes} onClose={() => setEditing(null)} />}
      {bulk && folders && <BulkForm folders={folders} classes={classes} onClose={() => setBulk(false)} />}
    </section>
  );
}

function FolderChecks({ folders, value, onChange }: { folders: Folder[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = value.includes("*");
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 700, fontSize: ".92rem", marginBottom: 8 }}>Thư mục được mở</legend>
      <div className="checks">
        <label className="check">
          <input type="checkbox" checked={all} onChange={() => onChange(all ? [] : ["*"])} />
          Tất cả thư mục
        </label>
        {folders.map((f) => (
          <label className="check" key={f.slug}>
            <input
              type="checkbox"
              disabled={all}
              checked={all || value.includes(f.slug)}
              onChange={(e) => onChange(e.target.checked ? [...value, f.slug] : value.filter((x) => x !== f.slug))}
            />
            {f.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StudentForm({ student, folders, classes, onClose }: { student: Student | null; folders: Folder[]; classes: string[]; onClose: () => void }) {
  const { token, toast } = useAdmin();
  const save = useMutation(api.admin.saveStudent);
  const [name, setName] = useState(student?.name ?? "");
  const [className, setClassName] = useState(student?.className ?? "");
  const [code, setCode] = useState(student?.code ?? "");
  const [picked, setPicked] = useState<string[]>(student?.folders ?? []);
  const [active, setActive] = useState(student?.active ?? true);
  const [note, setNote] = useState(student?.note ?? "");
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked.length && !confirm("Học sinh chưa được mở thư mục nào. Vẫn lưu?")) return;
    try {
      const r = await save({ token, id: student?._id, name, className, code, folders: picked, active, note });
      if (student) {
        toast("Đã lưu học sinh.");
        onClose();
      } else setCreated(r.code);
    } catch (e2) {
      setErr(errMsg(e2));
    }
  }

  if (created)
    return (
      <Modal title="Đã tạo học sinh" onClose={onClose}>
        <p>
          Mã cá nhân của <b>{name}</b> ({className}):
        </p>
        <p className="secret">{created}</p>
        <p className="small muted">Gửi mã này cho em. Em vào trang chủ, nhập mã là thấy bài được giao.</p>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={() => copyText(created, () => toast("Đã sao chép mã."), () => {})}>
            Sao chép mã
          </button>
          <button className="btn btn-primary" type="button" onClick={onClose}>
            Xong
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title={student ? "Sửa học sinh" : "Thêm học sinh"} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="row-2">
          <div className="field">
            <label htmlFor="s-name">Họ và tên</label>
            <input className="input" id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn Bình" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="s-class">Lớp</label>
            <input className="input" id="s-class" list="class-list" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="8A2" />
            <datalist id="class-list">
              {classes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="s-code">
              Mã cá nhân <span className="hint">{student ? "" : "(để trống sẽ tự tạo)"}</span>
            </label>
            <input className="input mono" id="s-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="binh4821" autoCapitalize="off" spellCheck={false} />
          </div>
          <div className="field">
            <label htmlFor="s-note">
              Ghi chú <span className="hint">(chỉ giáo viên thấy)</span>
            </label>
            <input className="input" id="s-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="SĐT phụ huynh, ca học…" />
          </div>
        </div>
        <FolderChecks folders={folders} value={picked} onChange={setPicked} />
        <label className="switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Mã đang mở (bỏ chọn để khóa, em sẽ không đăng nhập được)
        </label>
        <p className="alert alert-bad" role="alert" hidden={!err}>
          {err}
        </p>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" type="submit">
            {student ? "Lưu" : "Tạo mã"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Paste a class list: one student per line, "Name, Class" or "Name<TAB>Class" (class optional if set below). */
function BulkForm({ folders, classes, onClose }: { folders: Folder[]; classes: string[]; onClose: () => void }) {
  const { token, toast } = useAdmin();
  const create = useMutation(api.admin.bulkCreateStudents);
  const [text, setText] = useState("");
  const [className, setClassName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; className: string; code: string }[] | null>(null);

  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [n, c] = l.split(/\t|,|;/).map((x) => x.trim());
      return { name: n ?? "", className: c || className.trim() };
    });
  const missingClass = rows.filter((r) => !r.className).length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rows.length) return setErr("Dán danh sách học sinh, mỗi dòng một em.");
    if (missingClass) return setErr(`${missingClass} dòng chưa có lớp. Nhập lớp chung ở ô bên trên hoặc ghi "Tên, Lớp".`);
    if (!picked.length) return setErr("Chọn ít nhất một thư mục.");
    setBusy(true);
    try {
      setCreated(await create({ token, rows, folders: picked }));
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const out = created.map((s) => `${s.name} (${s.className}): ${s.code}`).join("\n");
    return (
      <Modal title={`Đã tạo ${created.length} học sinh`} onClose={onClose} wide>
        <textarea className="textarea" readOnly value={out} rows={Math.min(14, created.length + 1)} onFocus={(e) => e.currentTarget.select()} />
        <div className="modal-foot">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() =>
              downloadCsv(
                "ma-hoc-sinh-moi.csv",
                ["Họ tên", "Lớp", "Mã"],
                created.map((s) => [s.name, s.className, s.code]),
              )
            }
          >
            Tải CSV
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => copyText(out, () => toast("Đã sao chép danh sách mã."), () => {})}>
            Sao chép
          </button>
          <button className="btn btn-primary" type="button" onClick={onClose}>
            Xong
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Thêm nhiều học sinh" onClose={onClose} wide>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="b-list">
            Danh sách <span className="hint">— mỗi dòng một em: “Họ tên” hoặc “Họ tên, Lớp” (dán thẳng từ Excel cũng được)</span>
          </label>
          <textarea className="textarea prose" id="b-list" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Nguyễn Văn Bình, 8A2\nTrần Thị Mai, 8A2\nLê Hoàng Nam"} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="b-class">
            Lớp chung <span className="hint">(dùng cho dòng không ghi lớp)</span>
          </label>
          <input className="input" id="b-class" list="class-list-bulk" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="8A2" />
          <datalist id="class-list-bulk">
            {classes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <FolderChecks folders={folders} value={picked} onChange={setPicked} />
        <p className="alert alert-bad" role="alert" hidden={!err}>
          {err}
        </p>
        <div className="modal-foot">
          <span className="small muted" style={{ marginRight: "auto", alignSelf: "center" }}>
            {rows.length} học sinh
          </span>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Tạo mã cho {rows.length} em
          </button>
        </div>
      </form>
    </Modal>
  );
}
