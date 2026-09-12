import { AppShell } from "@/components/AppShell";
import { UserAccountsPanel } from "@/components/account-admin";
import { requireActor } from "@/lib/auth";
import { data } from "@/lib/data";

export default async function Users() {
  const actor = await requireActor(["ADMIN"]);
  const page = await data.usersPage();
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
      <UserAccountsPanel
        users={page.users}
        departments={page.departments}
        groups={page.groups}
      />
    </AppShell>
  );
}
