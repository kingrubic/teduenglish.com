"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { copyText, errMsg, stamp } from "@/lib/ui";
import { Modal, PasswordForm, useAdmin, useRun } from "./AdminShell";

type SettingsData = FunctionReturnType<typeof api.admin.settings>;

export default function Settings() {
  const { token, me, toast } = useAdmin();
  return (
    <>
      <div className="t-grid two" style={{ marginTop: 0 }}>
        <CenterSettings />
        <section className="panel">
          <div>
            <p className="eyebrow">Tài khoản của bạn</p>
            <h2>Đổi mật khẩu</h2>
            <p className="small muted">
              Đang đăng nhập: <b>{me.email}</b>. Đổi mật khẩu sẽ đăng xuất các thiết bị khác.
            </p>
          </div>
          <PasswordForm token={token} onDone={() => toast("Đã đổi mật khẩu.")} />
        </section>
      </div>
      <Admins />
    </>
  );
}

function CenterSettings() {
  const { token } = useAdmin();
  const run = useRun();
  const data = useQuery(api.admin.settings, { token });
  const save = useMutation(api.admin.saveSettings);
  const [form, setForm] = useState<SettingsData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data && !form) setForm(data);
  }, [data, form]);

  if (!form)
    return (
      <section className="panel">
        <p className="empty">Đang tải…</p>
      </section>
    );

  const set = (patch: Partial<SettingsData>) => setForm({ ...form, ...patch });

  return (
    <section className="panel">
      <div>
        <p className="eyebrow">Trang học sinh</p>
        <h2>Thông tin trung tâm</h2>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => save({ token, ...form }), "Đã lưu cài đặt.");
        }}
        noValidate
      >
        <div className="row-2">
          <div className="field">
            <label htmlFor="st-name">Tên trung tâm</label>
            <input className="input" id="st-name" value={form.centerName} onChange={(e) => set({ centerName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="st-teacher">
              Cách gọi giáo viên <span className="hint">(“em nhắn … ”)</span>
            </label>
            <input className="input" id="st-teacher" value={form.teacher} onChange={(e) => set({ teacher: e.target.value })} placeholder="thầy cô" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-tagline">Khẩu hiệu dưới logo</label>
          <input className="input" id="st-tagline" value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="st-contact">
            Liên hệ cuối trang <span className="hint">(để trống thì ẩn)</span>
          </label>
          <input className="input" id="st-contact" value={form.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Zalo lớp: 09xx xxx xxx" />
        </div>
        <label className="switch">
          <input type="checkbox" checked={form.showDemoHint} onChange={(e) => set({ showDemoHint: e.target.checked })} />
          Hiện mã dùng thử trên trang chủ
        </label>
        {form.showDemoHint && (
          <div className="field">
            <label htmlFor="st-demo">
              Mã dùng thử <span className="hint">(phải là mã của một học sinh có sẵn)</span>
            </label>
            <input className="input mono" id="st-demo" value={form.demoCode} onChange={(e) => set({ demoCode: e.target.value })} autoCapitalize="off" />
          </div>
        )}
        <div>
          <button className="btn btn-primary" type="submit">
            Lưu cài đặt
          </button>
        </div>
      </form>
    </section>
  );
}

function Admins() {
  const { token, me } = useAdmin();
  const run = useRun();
  const admins = useQuery(api.admin.admins, { token });
  const reset = useMutation(api.admin.resetAdminPassword);
  const setActive = useMutation(api.admin.setAdminActive);
  const del = useMutation(api.admin.deleteAdmin);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const owner = me.role === "owner";

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Người quản lý</p>
          <h2>Tài khoản giáo viên</h2>
          <p className="small muted">
            Giáo viên quản lý được học sinh, bài và kết quả. Chỉ <b>quản trị chính</b> mới thêm, khóa hoặc cấp lại mật khẩu cho tài khoản khác.
          </p>
        </div>
        {owner && (
          <div className="actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setAdding(true)}>
              + Thêm tài khoản
            </button>
          </div>
        )}
      </div>
      {!admins ? (
        <p className="empty">Đang tải…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Đăng nhập gần nhất</th>
                <th>Trạng thái</th>
                {owner && <th />}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a._id} className={a.active ? "" : "is-off"}>
                  <td>
                    <b>{a.name}</b>
                    {a._id === me.id && <span className="sub">Bạn</span>}
                  </td>
                  <td>{a.email}</td>
                  <td>{a.role === "owner" ? "Quản trị chính" : "Giáo viên"}</td>
                  <td className="tiny">{a.lastLoginAt ? stamp(a.lastLoginAt) : "Chưa đăng nhập"}</td>
                  <td>
                    {a.active ? <span className="status on">Đang mở</span> : <span className="status off">Đã khóa</span>}
                    {a.mustChangePassword && <span className="sub">Đang dùng mật khẩu tạm</span>}
                  </td>
                  {owner && (
                    <td>
                      {a._id !== me.id && (
                        <div className="row-actions">
                          <button
                            className="link-btn"
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Cấp mật khẩu tạm mới cho ${a.email}?`)) return;
                              const r = await run(() => reset({ token, id: a._id }));
                              if (r) setSecret({ email: a.email, password: r.password });
                            }}
                          >
                            Cấp lại mật khẩu
                          </button>
                          <button className="link-btn" type="button" onClick={() => run(() => setActive({ token, id: a._id, active: !a.active }), a.active ? "Đã khóa tài khoản." : "Đã mở tài khoản.")}>
                            {a.active ? "Khóa" : "Mở khóa"}
                          </button>
                          <button
                            className="link-btn danger"
                            type="button"
                            onClick={() => {
                              if (confirm(`Xóa tài khoản ${a.email}?`)) run(() => del({ token, id: a._id }), "Đã xóa tài khoản.");
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <AddAdmin
          onClose={() => setAdding(false)}
          onCreated={(email, password) => {
            setAdding(false);
            setSecret({ email, password });
          }}
        />
      )}
      {secret && <SecretDialog {...secret} onClose={() => setSecret(null)} />}
    </section>
  );
}

function AddAdmin({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string, password: string) => void }) {
  const { token } = useAdmin();
  const create = useMutation(api.admin.createAdmin);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "teacher">("teacher");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await create({ token, email, name, role });
      onCreated(email.trim().toLowerCase(), r.password);
    } catch (e2) {
      setErr(errMsg(e2));
    }
  }

  return (
    <Modal title="Thêm tài khoản giáo viên" onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="row-2">
          <div className="field">
            <label htmlFor="ad-name">Tên hiển thị</label>
            <input className="input" id="ad-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cô Lan" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="ad-email">Email đăng nhập</label>
            <input className="input" id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ad-role">Vai trò</label>
          <select className="select" id="ad-role" value={role} onChange={(e) => setRole(e.target.value as "owner" | "teacher")}>
            <option value="teacher">Giáo viên</option>
            <option value="owner">Quản trị chính</option>
          </select>
        </div>
        <p className="small muted">Hệ thống tạo mật khẩu tạm; người được thêm phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
        <p className="alert alert-bad" role="alert" hidden={!err}>
          {err}
        </p>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" type="submit">
            Tạo tài khoản
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SecretDialog({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const { toast } = useAdmin();
  return (
    <Modal title="Mật khẩu tạm" onClose={onClose}>
      <p>
        Gửi thông tin này cho <b>{email}</b> qua kênh riêng. Mật khẩu chỉ hiện một lần.
      </p>
      <p className="secret">{password}</p>
      <div className="modal-foot">
        <button className="btn btn-ghost" type="button" onClick={() => copyText(`Email: ${email}\nMật khẩu tạm: ${password}`, () => toast("Đã sao chép."), () => {})}>
          Sao chép
        </button>
        <button className="btn btn-primary" type="button" onClick={onClose}>
          Xong
        </button>
      </div>
    </Modal>
  );
}
