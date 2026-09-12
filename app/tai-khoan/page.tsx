import { AppShell } from "@/components/AppShell";
import { changePassword } from "@/lib/actions";
import { requireActor } from "@/lib/auth";
import { MIN_NEW_PASSWORD } from "@/lib/password";

const ERRORS: Record<string, string> = {
  short: `Mật khẩu mới phải có tối thiểu ${MIN_NEW_PASSWORD} ký tự.`,
  same: "Mật khẩu mới phải khác mật khẩu tạm hiện tại.",
  current: "Mật khẩu hiện tại không đúng.",
};

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, actor] = await Promise.all([
    searchParams,
    requireActor(undefined, { allowMustChangePassword: true }),
  ]);
  return (
    <AppShell actor={actor}>
      <div className="content-head">
        <div>
          <div className="eyebrow">Bảo mật tài khoản</div>
          <h1>Đổi mật khẩu</h1>
          {actor.mustChangePassword && (
            <p className="muted">
              Bạn đang dùng mật khẩu tạm. Đặt mật khẩu mới (tối thiểu{" "}
              {MIN_NEW_PASSWORD} ký tự, khác mật khẩu tạm) trước khi vào các
              trang khác.
            </p>
          )}
        </div>
      </div>
      <section className="card account-security">
        {error && (
          <p className="error" role="alert">
            {ERRORS[error] || "Không đổi được mật khẩu. Thử lại."}
          </p>
        )}
        <form className="form" action={changePassword}>
          <label>
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type="password"
              minLength={8}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            Mật khẩu mới
            <input
              name="newPassword"
              type="password"
              minLength={MIN_NEW_PASSWORD}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="button">Đổi mật khẩu và đăng xuất thiết bị</button>
        </form>
      </section>
    </AppShell>
  );
}
