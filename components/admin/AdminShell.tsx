"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/convex/_generated/api";
import { errMsg, sdel, sget, sset } from "@/lib/ui";

type Me = NonNullable<FunctionReturnType<typeof api.admin.me>>;
type AdminCtx = { token: string; me: Me; toast: (msg: string) => void };

const Ctx = createContext<AdminCtx | null>(null);
const TOKEN_KEY = "tedu.admin";

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside AdminShell");
  return c;
}

const NAV = [
  ["/admin", "Tổng quan"],
  ["/admin/hoc-sinh", "Học sinh"],
  ["/admin/thu-muc", "Thư mục"],
  ["/admin/bai-lam", "Bài làm trên web"],
  ["/admin/tai-lieu", "Tài liệu & liên kết"],
  ["/admin/ket-qua", "Kết quả"],
  ["/admin/thong-ke", "Thống kê"],
  ["/admin/cai-dat", "Cài đặt & tài khoản"],
  ["/admin/huong-dan", "📖 Hướng dẫn"],
] as const;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const me = useQuery(api.admin.me, token ? { token } : "skip");
  const logoutMut = useMutation(api.admin.logout);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(sget<string | null>("localStorage", TOKEN_KEY, null));
    document.title = "Quản trị · TEDU English";
  }, []);

  useEffect(() => {
    if (token && me === null) {
      sdel("localStorage", TOKEN_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(null);
    }
  }, [me, token]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 3600);
  }, []);

  function signIn(t: string) {
    sset("localStorage", TOKEN_KEY, t);
    setToken(t);
  }
  function signOut() {
    if (token) logoutMut({ token }).catch(() => {});
    sdel("localStorage", TOKEN_KEY);
    setToken(null);
  }

  let content: React.ReactNode;
  if (token === undefined || (token && me === undefined)) content = <p className="empty">Đang tải…</p>;
  else if (!token || !me) content = <AdminLogin onDone={signIn} />;
  else if (me.mustChangePassword) content = <ForcePasswordChange token={token} me={me} onSignOut={signOut} toast={toast} />;
  else
    content = (
      <Ctx.Provider value={{ token, me, toast }}>
        <nav className="admin-nav" aria-label="Quản trị">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={(href === "/admin" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </Ctx.Provider>
    );

  return (
    <>
      <div className="site-cq">
        <div className="shell admin-shell">
          <header className="site-header">
            <Link className="brand" href="/admin" aria-label="TEDU English, trang quản trị">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-mark" src="/tedu-mark.png" alt="" width={58} height={46} />
              <span className="brand-text">
                <span className="wordmark">
                  <span className="a">TEDU</span>
                  <span className="b">ENGLISH</span>
                </span>
                <span className="tagline">Khu vực giáo viên</span>
              </span>
            </Link>
            <div className="header-actions">
              {me && token && (
                <>
                  <span className="who">
                    <span className="avatar" aria-hidden="true">
                      {me.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <b>{me.name}</b>
                      <span className="who-class muted"> · {me.role === "owner" ? "Quản trị chính" : "Giáo viên"}</span>
                    </span>
                  </span>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={signOut}>
                    Đăng xuất
                  </button>
                </>
              )}
              <Link className="btn btn-ghost btn-sm" href="/" target="_blank">
                Xem trang học sinh ↗
              </Link>
            </div>
          </header>
          <main>{content}</main>
          <footer className="site-footer">
            <span>TEDU English · Khu vực giáo viên</span>
            <nav aria-label="Liên kết cuối trang">
              <Link href="/">Trang học tập</Link>
            </nav>
          </footer>
        </div>
      </div>
      <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>
        {toastMsg}
      </div>
    </>
  );
}

function AdminLogin({ onDone }: { onDone: (token: string) => void }) {
  const login = useMutation(api.admin.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setErr("Nhập email và mật khẩu.");
    setBusy(true);
    try {
      const r = await login({ email, password });
      if (r.ok) onDone(r.token);
      else setErr(r.error);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="gate view-enter" style={{ marginInline: "auto", width: "100%" }}>
        <div className="logo-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tedu-logo.png" alt="TEDU English, Better English Brighter Futures" width={220} height={163} />
        </div>
        <div>
          <p className="eyebrow">Teacher only</p>
          <h2>Khu vực giáo viên</h2>
          <p className="small muted">Đăng nhập để quản lý học sinh, bài làm, tài liệu và xem điểm cả lớp.</p>
        </div>
        <form className="stack" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input className="input" id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="admin-pw">Mật khẩu</label>
            <input
              className="input"
              id="admin-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <p className="alert alert-bad" role="alert" hidden={!err}>
            {err}
          </p>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function PasswordForm({ token, onDone, submitLabel = "Đổi mật khẩu" }: { token: string; onDone: () => void; submitLabel?: string }) {
  const change = useMutation(api.admin.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return setErr("Hai lần nhập mật khẩu mới chưa khớp.");
    setBusy(true);
    try {
      await change({ token, current, next });
      setErr("");
      setCurrent("");
      setNext("");
      setAgain("");
      onDone();
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="pw-cur">Mật khẩu hiện tại</label>
        <input className="input" id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="pw-new">
            Mật khẩu mới <span className="hint">(≥ 8 ký tự, có chữ và số)</span>
          </label>
          <input className="input" id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw-again">Nhập lại mật khẩu mới</label>
          <input className="input" id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
      </div>
      <p className="alert alert-bad" role="alert" hidden={!err}>
        {err}
      </p>
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function ForcePasswordChange({ token, me, onSignOut, toast }: { token: string; me: Me; onSignOut: () => void; toast: (m: string) => void }) {
  return (
    <section className="gate view-enter" style={{ marginInline: "auto" }}>
      <div>
        <p className="eyebrow">Bảo mật tài khoản</p>
        <h2>Đặt mật khẩu mới</h2>
        <p className="small muted">
          Tài khoản <b>{me.email}</b> đang dùng mật khẩu tạm. Hãy đặt mật khẩu riêng trước khi vào khu vực quản trị.
        </p>
      </div>
      <PasswordForm token={token} onDone={() => toast("Đã đổi mật khẩu.")} submitLabel="Lưu mật khẩu mới" />
      <div>
        <button className="link-btn" type="button" onClick={onSignOut}>
          Đăng xuất
        </button>
      </div>
    </section>
  );
}

/** Simple modal with a backdrop; closes on Escape or backdrop click. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [onClose]);
  // Portal: .site-cq is a size container, which would trap position: fixed.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Runs a mutation, toasting the outcome; returns the result or undefined on failure. */
export function useRun() {
  const { toast } = useAdmin();
  return useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast(errMsg(e));
        return undefined;
      }
    },
    [toast],
  );
}
