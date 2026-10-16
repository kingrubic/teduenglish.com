"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { KIND } from "@/components/site/parts";
import { MAX_AUDIO_BYTES, MAX_PDF_BYTES, formatBytes } from "@/convex/model";
import type { Id } from "@/convex/_generated/dataModel";
import { errMsg, safeUrl } from "@/lib/ui";
import { Modal, useAdmin, useRun } from "./AdminShell";

type Resource = FunctionReturnType<typeof api.admin.resources>[number];
type Kind = Resource["kind"];

export default function Resources() {
  const { token } = useAdmin();
  const run = useRun();
  const rows = useQuery(api.admin.resources, { token });
  const folders = useQuery(api.admin.folders, { token });
  const move = useMutation(api.admin.moveResource);
  const del = useMutation(api.admin.deleteResource);
  const setHidden = useMutation(api.admin.setResourceHidden);
  const [folder, setFolder] = useState("");
  const [editing, setEditing] = useState<Resource | "new" | null>(null);

  const folderName = useMemo(() => new Map((folders ?? []).map((f) => [f.slug, f.name])), [folders]);
  const list = (rows ?? []).filter((r) => !folder || r.folder === folder);
  const ordered = folders ? [...list].sort((a, b) => (folders.findIndex((f) => f.slug === a.folder) - folders.findIndex((f) => f.slug === b.folder)) || a.order - b.order) : list;

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Mở trong tab mới</p>
          <h2>Tài liệu &amp; liên kết</h2>
          <p className="small muted">File PDF (học sinh xem ngay trên web hoặc tải về), bài nghe MP3 (nghe ngay trong danh sách) và link Quizlet, Wordwall, Google Drive, YouTube…</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setEditing("new")} disabled={!folders?.length}>
            + Thêm tài liệu
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="filters">
          <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Lọc theo thư mục">
            <option value="">Tất cả thư mục</option>
            {folders?.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <span className="count-chip">{list.length} tài liệu</span>
      </div>
      {!rows ? (
        <p className="empty">Đang tải…</p>
      ) : !list.length ? (
        <p className="empty">Chưa có tài liệu nào.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thứ tự</th>
                <th>Bài</th>
                <th>Thư mục</th>
                <th>Loại</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => {
                const siblings = ordered.filter((x) => x.folder === r.folder);
                const idx = siblings.indexOf(r);
                return (
                  <tr key={r._id} className={r.hidden ? "is-off" : ""}>
                    <td>
                      <div className="row-actions">
                        <button className="link-btn" type="button" disabled={idx === 0} onClick={() => run(() => move({ token, id: r._id, dir: -1 }))} aria-label="Lên">
                          ↑
                        </button>
                        <button className="link-btn" type="button" disabled={idx === siblings.length - 1} onClick={() => run(() => move({ token, id: r._id, dir: 1 }))} aria-label="Xuống">
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <a href={safeUrl(r.fileUrl ?? r.url)} target="_blank" rel="noopener noreferrer">
                        <b>{r.title}</b>
                      </a>
                      {r.description && <span className="sub">{r.description}</span>}
                      {r.file ? (
                        <span className="sub">
                          {r.file.media === "audio" ? "🎧" : "📄"} {r.file.name} · {formatBytes(r.file.size)}
                        </span>
                      ) : (
                        <span className="sub mono" style={{ overflowWrap: "anywhere" }}>
                          {r.url}
                        </span>
                      )}
                    </td>
                    <td>{folderName.get(r.folder) ?? r.folder}</td>
                    <td>
                      <span className="tag">{KIND[r.kind]}</span>
                      {r.file && <span className="tag">{r.file.media === "audio" ? "MP3" : "PDF"}</span>}
                      {r.term && <span className="tag">{r.term === "hk1" ? "HK1" : "HK2"}</span>}
                      {r.hidden ? <span className="status draft">Đang ẩn</span> : <span className="status on">Đang hiện</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="link-btn" type="button" onClick={() => setEditing(r)}>
                          Sửa
                        </button>
                        <button
                          className="link-btn"
                          type="button"
                          onClick={() => run(() => setHidden({ token, id: r._id, hidden: !r.hidden }), r.hidden ? "Đã hiện lại cho học sinh." : "Đã ẩn khỏi trang học sinh.")}
                        >
                          {r.hidden ? "Hiện" : "Ẩn"}
                        </button>
                        <button
                          className="link-btn danger"
                          type="button"
                          onClick={() => {
                            if (confirm(`Xóa "${r.title}"?${r.file ? (r.file.media === "audio" ? " File nghe cũng sẽ bị xóa." : " File PDF cũng sẽ bị xóa.") : ""}`)) run(() => del({ token, id: r._id }), "Đã xóa tài liệu.");
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
      {editing && folders && <ResourceForm res={editing === "new" ? null : editing} folders={folders} defaultFolder={folder} onClose={() => setEditing(null)} />}
    </section>
  );
}

/** Uploads straight to Convex storage, reporting progress. */
function uploadFile(uploadUrl: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).storageId);
        else reject(new Error(String(xhr.status)));
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

function ResourceForm({
  res,
  folders,
  defaultFolder,
  onClose,
}: {
  res: Resource | null;
  folders: { slug: string; name: string }[];
  defaultFolder: string;
  onClose: () => void;
}) {
  const { token, toast } = useAdmin();
  const save = useMutation(api.admin.saveResource);
  const getUploadUrl = useMutation(api.admin.generateUploadUrl);
  type Source = "file" | "audio" | "url";
  const [source, setSourceState] = useState<Source>(res ? (res.file ? (res.file.media === "audio" ? "audio" : "file") : "url") : "file");
  const [folder, setFolder] = useState(res?.folder ?? (defaultFolder || folders[0]?.slug || ""));
  const [kind, setKind] = useState<Kind>(res?.kind ?? "doc");
  const [title, setTitle] = useState(res?.title ?? "");
  const [url, setUrl] = useState(res?.url ?? "");
  const [description, setDescription] = useState(res?.description ?? "");
  const [hidden, setHiddenField] = useState(!!res?.hidden);
  const [term, setTerm] = useState<"" | "hk1" | "hk2">(res?.term ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const audio = source === "audio";
  // The file this resource already has, if it matches the chosen source.
  const current = res?.file && (res.file.media === "audio") === audio && source !== "url" ? res.file : null;

  function setSource(s: Source) {
    setSourceState(s);
    setFile(null);
    setErr("");
    if (s === "audio" && kind === "doc") setKind("audio");
    if (s !== "audio" && kind === "audio") setKind("doc");
  }

  function fileType(f: File) {
    if (!audio) return "application/pdf";
    return f.type.startsWith("audio/") ? f.type : /\.mp3$/i.test(f.name) ? "audio/mpeg" : /\.m4a$/i.test(f.name) ? "audio/mp4" : /\.wav$/i.test(f.name) ? "audio/wav" : "";
  }

  function pick(f: File | null) {
    setErr("");
    if (!f) return setFile(null);
    if (audio) {
      if (!fileType(f)) return setErr("Chỉ nhận file âm thanh (MP3, M4A, WAV…).");
      if (f.size > MAX_AUDIO_BYTES) return setErr(`File quá lớn (${formatBytes(f.size)}). Tối đa ${formatBytes(MAX_AUDIO_BYTES)}.`);
    } else {
      if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return setErr("Chỉ nhận file PDF.");
      if (f.size > MAX_PDF_BYTES) return setErr(`File quá lớn (${formatBytes(f.size)}). Tối đa ${formatBytes(MAX_PDF_BYTES)}.`);
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_-]+/g, " ").trim());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (progress !== null) return;
    if (source !== "url" && !file && !current) return setErr(audio ? "Chọn file MP3 để tải lên." : "Chọn file PDF để tải lên.");
    try {
      let storageId: Id<"_storage"> | undefined;
      if (source !== "url" && file) {
        setProgress(0);
        storageId = await uploadFile(await getUploadUrl({ token }), file, fileType(file), setProgress);
      }
      await save({ token, id: res?._id, folder, kind, title, description, source, url, storageId, fileName: file?.name, hidden, term: term || undefined });
      toast(res ? "Đã lưu tài liệu." : "Đã thêm tài liệu.");
      onClose();
    } catch (e2) {
      setErr(errMsg(e2, "Tải file chưa thành công. Kiểm tra mạng rồi thử lại."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Modal title={res ? "Sửa tài liệu" : "Thêm tài liệu"} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="checks" role="radiogroup" aria-label="Nguồn tài liệu">
          <label className="check">
            <input type="radio" name="source" checked={source === "file"} onChange={() => setSource("file")} />
            Tải file PDF lên
          </label>
          <label className="check">
            <input type="radio" name="source" checked={source === "audio"} onChange={() => setSource("audio")} />
            Tải file MP3 lên
          </label>
          <label className="check">
            <input type="radio" name="source" checked={source === "url"} onChange={() => setSource("url")} />
            Dán đường link
          </label>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="r-folder">Thư mục</label>
            <select className="select" id="r-folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
              {folders.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-kind">Loại</label>
            <select className="select" id="r-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="doc">Tài liệu</option>
              <option value="exercise">Bài tập</option>
              <option value="game">Trò chơi</option>
              <option value="video">Video</option>
              <option value="audio">Bài nghe</option>
            </select>
          </div>
        </div>
        {source !== "url" ? (
          <div className="field">
            <label htmlFor="r-file">
              {audio ? "File nghe MP3" : "File PDF"} <span className="hint">(tối đa {formatBytes(audio ? MAX_AUDIO_BYTES : MAX_PDF_BYTES)})</span>
            </label>
            <input
              key={source}
              className="input"
              id="r-file"
              type="file"
              accept={audio ? "audio/*,.mp3,.m4a,.wav" : "application/pdf,.pdf"}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {current && !file && (
              <span className="tiny muted">
                Đang dùng: <b>{current.name}</b> · {formatBytes(current.size)}. Chọn file khác nếu muốn thay.
              </span>
            )}
            {audio && current && !file && res?.fileUrl && <audio className="section-audio" controls preload="none" src={res.fileUrl} />}
            {file && (
              <span className="tiny muted">
                Sẽ tải lên: <b>{file.name}</b> · {formatBytes(file.size)}
              </span>
            )}
          </div>
        ) : (
          <div className="field">
            <label htmlFor="r-url">Đường link</label>
            <input className="input" id="r-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://wordwall.net/…" />
          </div>
        )}
        <div className="field">
          <label htmlFor="r-term">Học kỳ</label>
          <select className="select" id="r-term" value={term} onChange={(e) => setTerm(e.target.value as "" | "hk1" | "hk2")}>
            <option value="">Không chia học kỳ</option>
            <option value="hk1">Học kỳ 1</option>
            <option value="hk2">Học kỳ 2</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-title">Tên tài liệu</label>
          <input className="input" id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 4 · Worksheet" />
        </div>
        <div className="field">
          <label htmlFor="r-desc">
            Mô tả ngắn <span className="hint">(không bắt buộc)</span>
          </label>
          <input className="input" id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="In ra hoặc làm trực tiếp trên giấy" />
        </div>
        <label className="switch">
          <input type="checkbox" checked={hidden} onChange={(e) => setHiddenField(e.target.checked)} />
          Tạm ẩn khỏi trang học sinh (giao sau)
        </label>
        {progress !== null && (
          <div className="progress-row">
            <span>Đang tải lên {progress}%</span>
            <span className="progress" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}
        <p className="alert alert-bad" role="alert" hidden={!err}>
          {err}
        </p>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={progress !== null}>
            Hủy
          </button>
          <button className="btn btn-primary" type="submit" disabled={progress !== null}>
            {progress !== null ? "Đang tải lên…" : "Lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
