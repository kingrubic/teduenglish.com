"use client";
import { useState, useTransition } from "react";
import { adminResetPassword, createUser, updateUserStatus } from "@/lib/actions";
import { generateTempPassword, MIN_NEW_PASSWORD } from "@/lib/password";

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MOD: "Giáo viên",
  USER: "Học sinh",
};

type Reveal = { name: string; email: string; tempPassword: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department: string | null;
  groups: string | null;
  mustChangePassword: boolean;
};

function isReveal(result: Reveal | { error: string }): result is Reveal {
  return "tempPassword" in result;
}

function TempPasswordReveal({ reveal }: { reveal: Reveal }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(reveal.tempPassword);
    setCopied(true);
  }
  return (
    <div className="temp-password-reveal" role="status">
      <strong>Mật khẩu tạm — chỉ hiện một lần</strong>
      <p className="muted">
        Gửi cho {reveal.name} ({reveal.email}). Sao chép ngay; sau khi rời
        trang sẽ không xem lại được.
      </p>
      <code>{reveal.tempPassword}</code>
      <button className="button secondary" type="button" onClick={copy}>
        {copied ? "Đã sao chép" : "Sao chép mật khẩu"}
      </button>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "password-field-row compact" : "password-field-row"}>
      <input
        name="password"
        type="text"
        autoComplete="new-password"
        minLength={MIN_NEW_PASSWORD}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Tối thiểu ${MIN_NEW_PASSWORD} ký tự`}
        required
      />
      <button
        className="button secondary"
        type="button"
        onClick={() => onChange(generateTempPassword())}
      >
        Tạo mật khẩu
      </button>
    </div>
  );
}

export function UserAccountsPanel({
  users,
  departments,
  groups,
}: {
  users: UserRow[];
  departments: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}) {
  const [created, setCreated] = useState<Reveal | null>(null);
  const [resets, setResets] = useState<Record<string, Reveal>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>(
    {},
  );
  const [formKey, setFormKey] = useState(0);
  const [creating, startCreate] = useTransition();
  const [resetting, startReset] = useTransition();

  function submitCreate(formData: FormData) {
    setCreateError(null);
    startCreate(async () => {
      const result = await createUser(formData);
      if (!isReveal(result)) {
        setCreateError(result.error);
        return;
      }
      setCreated(result);
      setPassword("");
      setFormKey((key) => key + 1);
    });
  }

  function submitReset(userId: string, formData: FormData) {
    setResetErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    startReset(async () => {
      const result = await adminResetPassword(formData);
      if (!isReveal(result)) {
        setResetErrors((current) => ({ ...current, [userId]: result.error }));
        return;
      }
      setResets((current) => ({ ...current, [userId]: result }));
      setResetPasswords((current) => ({ ...current, [userId]: "" }));
    });
  }

  return (
    <div className="columns user-layout">
      <section className="data-list">
        {users.map((user) => (
          <article className="data-row" key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <div className="muted">
                {user.email} · {user.department || "Chưa có phòng ban"}
              </div>
              <small>{user.groups || "Quyền theo vai trò hệ thống"}</small>
            </div>
            <div>
              <span
                className={`tag ${user.role === "ADMIN" ? "danger" : user.role === "MOD" ? "warning" : ""}`}
              >
                {roleLabels[user.role] || user.role}
              </span>
              {user.mustChangePassword && (
                <>
                  {" "}
                  <span className="tag warning">Chờ đổi MK</span>
                </>
              )}
              <br />
              <small>{user.status}</small>
              <form className="inline-admin-form" action={updateUserStatus}>
                <input type="hidden" name="userId" value={user.id} />
                <select name="status" defaultValue={user.status}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                  <option value="SUSPENDED">Khóa</option>
                </select>
                <button className="button secondary">Cập nhật</button>
              </form>
              <form
                className="inline-admin-form reset-password-form"
                action={(formData) => submitReset(user.id, formData)}
              >
                <input type="hidden" name="userId" value={user.id} />
                <PasswordField
                  compact
                  value={resetPasswords[user.id] ?? ""}
                  onChange={(value) =>
                    setResetPasswords((current) => ({
                      ...current,
                      [user.id]: value,
                    }))
                  }
                />
                <button className="button secondary" disabled={resetting}>
                  Đặt lại mật khẩu
                </button>
              </form>
              {resetErrors[user.id] && (
                <p className="error" role="alert">
                  {resetErrors[user.id]}
                </p>
              )}
              {resets[user.id] && (
                <TempPasswordReveal reveal={resets[user.id]} />
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Tạo tài khoản mới</h2>
        <p className="muted">
          Muốn tạo cho học sinh, giữ lựa chọn mặc định “Học sinh”. Mật khẩu tạm
          chỉ hiện một lần sau khi tạo.
        </p>
        {created && <TempPasswordReveal reveal={created} />}
        {createError && (
          <p className="error" role="alert">
            {createError}
          </p>
        )}
        <form className="form" action={submitCreate} key={formKey}>
          <label>
            Họ và tên
            <input name="name" required minLength={2} />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Mật khẩu tạm
            <PasswordField value={password} onChange={setPassword} />
          </label>
          <label>
            Cấp tài khoản
            <select name="role" defaultValue="USER">
              <option value="USER">Học sinh</option>
              <option value="MOD">Giáo viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </label>
          <label>
            Phòng ban (dành cho giáo viên/nhân sự)
            <select name="departmentId" defaultValue="">
              <option value="">Không gán</option>
              {departments.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="menu-permissions">
            <legend>Nhóm quyền bổ sung cho học sinh</legend>
            {groups.map((group) => (
              <label key={group.id}>
                <input type="checkbox" name="groupIds" value={group.id} />
                <span>{group.name}</span>
              </label>
            ))}
          </fieldset>
          <button className="button accent" disabled={creating}>
            {creating ? "Đang lưu..." : "Tạo tài khoản đăng nhập"}
          </button>
        </form>
      </section>
    </div>
  );
}
