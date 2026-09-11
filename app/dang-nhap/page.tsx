import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/actions";
import { getSiteSettings } from "@/lib/site";

export default async function Login({searchParams}:{searchParams:Promise<{error?:string;changed?:string}>}){
  const [{error,changed},site]=await Promise.all([searchParams,getSiteSettings()]);
  return <main className="auth-shell">
    <section className="auth-frame">
      <div className="auth-story">
        <Link className="auth-logo" href="/" aria-label={`${site.brandName} — Trang chủ`}><Image src="/teduenglish-logo.png" width={1254} height={888} priority alt={site.brandName}/></Link>
        <div className="auth-story-copy">
          <span className="eyebrow light">Cổng học tập TEDUENGLISH</span>
          <h1>Học có lộ trình<br/>Tiến bộ có căn cứ</h1>
          <p>Một không gian thống nhất để học sinh theo dõi bài học, bài tập và tiến độ; giáo viên quản lý lớp học và nội dung.</p>
        </div>
        <div className="auth-proof"><span>01&nbsp; Lộ trình rõ ràng</span><span>02&nbsp; Phản hồi liên tục</span><span>03&nbsp; Theo dõi tiến bộ</span></div>
      </div>
      <div className="auth-panel">
        <Link className="auth-back" href="/">← Về trang chủ</Link>
        <div className="auth-card">
          <span className="eyebrow">Chào mừng trở lại</span>
          <h2>Đăng nhập</h2>
          <p className="muted">Sử dụng tài khoản được cấp để tiếp tục.</p>
          {changed&&<p className="success">Đã đổi mật khẩu. Vui lòng đăng nhập lại.</p>}{error&&<p className="error" role="alert">{error==="locked"?"Đăng nhập tạm khóa 15 phút do thử sai quá nhiều lần.":"Email hoặc mật khẩu không đúng."}</p>}
          <form className="form" action={login}>
            <label>Email<input name="email" type="email" autoComplete="email" placeholder="name@example.com" required/></label>
            <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required minLength={8}/></label>
            <button className="button auth-submit" type="submit">Đăng nhập <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-help">Cần hỗ trợ tài khoản? Liên hệ quản trị viên của trung tâm.</p>
        </div>
      </div>
    </section>
  </main>
}
