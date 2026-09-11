import { AppShell } from "@/components/AppShell";
import { adminResetPassword, createUser, updateUserStatus } from "@/lib/actions";
import { requireActor } from "@/lib/auth";
import { data } from "@/lib/data";

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MOD: "Giáo viên",
  USER: "Học sinh",
};

export default async function Users() {
  const actor = await requireActor(["ADMIN"]);
  const page = await data.usersPage();
  const users = { rows: page.users };
  const departments = { rows: page.departments };
  const groups = { rows: page.groups };
  return (
    <AppShell actor={actor}>
      <div className="content-head">
        <div>
          <div className="eyebrow">Tài khoản & truy cập</div>
          <h1>Tài khoản & phân quyền</h1>
          <p className="muted">
            Tạo tài khoản đăng nhập và chọn đúng cấp truy cập cho từng người.
          </p>
        </div>
        <span className="tag">Chỉ Admin</span>
      </div>
      <div className="account-levels">
        <article>
          <span>01</span>
          <div>
            <strong>Quản trị viên</strong>
            <small>Toàn quyền cấu hình hệ thống và phân quyền.</small>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <strong>Giáo viên</strong>
            <small>Quản lý lớp, tài liệu, bài tập và học sinh.</small>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <strong>Học sinh</strong>
            <small>Đăng nhập cổng học tập; sau đó được thêm vào lớp học.</small>
          </div>
        </article>
      </div>
      <div className="columns user-layout">
        <section className="data-list">
          {users.rows.map((user) => (
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
                <br />
                <small>{user.status}</small>
                <form className="inline-admin-form" action={updateUserStatus}>
                  <input type="hidden" name="userId" value={user.id}/>
                  <select name="status" defaultValue={user.status}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm ngưng</option><option value="SUSPENDED">Khóa</option></select>
                  <button className="button secondary">Cập nhật</button>
                </form>
                <form className="inline-admin-form" action={adminResetPassword}>
                  <input type="hidden" name="userId" value={user.id}/><input name="password" type="password" minLength={8} placeholder="Mật khẩu mới" required/><button className="button secondary">Đặt lại mật khẩu</button>
                </form>
              </div>
            </article>
          ))}
        </section>
        <section className="card">
          <h2>Tạo tài khoản mới</h2>
          <p className="muted">
            Muốn tạo cho học sinh, giữ lựa chọn mặc định “Học sinh”.
          </p>
          <form className="form" action={createUser}>
            <label>
              Họ và tên
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Mật khẩu tạm
              <input name="password" type="password" minLength={8} required />
            </label>
            <label>
              Cấp tài khoản
              <select name="role">
                <option value="USER">Học sinh</option>
                <option value="MOD">Giáo viên</option>
                <option value="ADMIN">Quản trị viên</option>
              </select>
            </label>
            <label>
              Phòng ban (dành cho giáo viên/nhân sự)
              <select name="departmentId">
                <option value="">Không gán</option>
                {departments.rows.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="menu-permissions">
              <legend>Nhóm quyền bổ sung cho học sinh</legend>
              {groups.rows.map((group) => (
                <label key={group.id}>
                  <input type="checkbox" name="groupIds" value={group.id} />
                  <span>{group.name}</span>
                </label>
              ))}
            </fieldset>
            <button className="button accent">Tạo tài khoản đăng nhập</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
