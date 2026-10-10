"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { firstName } from "@/convex/model";
import { sdel, sget, signalReady, sset } from "@/lib/ui";
import DocReader from "./DocReader";

export type HomeData = FunctionReturnType<typeof api.site.home>;
export type Settings = HomeData["settings"];

type SiteCtx = {
  /** null until we've read localStorage (first client render). */
  token: string | null | undefined;
  home: HomeData | undefined;
  settings: Settings;
  teacher: string;
  signIn: (token: string) => void;
  signOut: () => void;
  toast: (msg: string) => void;
  /** Uploaded PDF open in the side reader, if any. */
  docId: string | null;
  openDoc: (id: string | null) => void;
};

const TOKEN_KEY = "tedu.token";
const DOC_KEY = "tedu.doc";
const DEFAULT_SETTINGS: Settings = {
  centerName: "TEDU English",
  tagline: "Better English · Brighter Futures",
  teacher: "thầy cô",
  contact: "",
  demoCode: "",
};

const Ctx = createContext<SiteCtx | null>(null);

export function useSite() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSite must be used inside SiteShell");
  return c;
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const home = useQuery(api.site.home, token === undefined ? "skip" : { token: token ?? undefined });
  const logoutMut = useMutation(api.site.logout);

  useEffect(() => {
    // Reading browser storage has to wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(sget<string | null>("localStorage", TOKEN_KEY, null));
  }, []);

  // Links from the old static site used hash routes (#quiz-id, #folder-id, #teacher).
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (!h || pathname !== "/") return;
    if (h.startsWith("quiz-")) router.replace(`/bai/${h.slice(5)}`);
    else if (h.startsWith("folder-")) router.replace(`/thu-muc/${h.slice(7)}`);
    else if (h === "teacher") router.replace("/admin");
  }, [pathname, router]);

  // A stored token that no longer matches a student (expired, code changed, locked).
  useEffect(() => {
    if (home && token && !home.student) {
      sdel("localStorage", TOKEN_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(null);
    }
  }, [home, token]);

  useEffect(() => {
    if (home) signalReady();
  }, [home]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // The open PDF survives navigation in the left column and reloads (per tab).
  const [docId, setDocId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDocId(sget<string | null>("sessionStorage", DOC_KEY, null));
  }, []);
  const openDoc = useCallback((id: string | null) => {
    setDocId(id);
    if (id) sset("sessionStorage", DOC_KEY, id);
    else sdel("sessionStorage", DOC_KEY);
  }, []);
  const closeDoc = useCallback(() => openDoc(null), [openDoc]);
  useEffect(() => {
    if (!docId) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [docId]);

  const signIn = useCallback((t: string) => {
    sset("localStorage", TOKEN_KEY, t);
    setToken(t);
  }, []);

  const signOut = useCallback(() => {
    const t = token;
    sdel("localStorage", TOKEN_KEY);
    setToken(null);
    openDoc(null);
    if (t) logoutMut({ token: t }).catch(() => {});
    router.push("/");
    window.scrollTo(0, 0);
  }, [logoutMut, openDoc, router, token]);

  const settings = home?.settings ?? DEFAULT_SETTINGS;
  const student = home?.student;

  return (
    <Ctx.Provider
      value={{
        token,
        home,
        settings,
        teacher: settings.teacher || "thầy cô",
        signIn,
        signOut,
        toast,
        docId,
        openDoc,
      }}
    >
      <div className={docId ? "reader" : undefined}>
        <div className="site-cq">
          <div className="shell">
            <header className="site-header">
              <Link className="brand" href="/" aria-label="TEDU English, về trang học tập">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="brand-mark" src="/tedu-mark.png" alt="" width={58} height={46} />
                <span className="brand-text">
                  <span className="wordmark">
                    <span className="a">TEDU</span>
                    <span className="b">ENGLISH</span>
                  </span>
                  <span className="tagline">{settings.tagline || "Better English · Brighter Futures"}</span>
                </span>
              </Link>
              <div className="header-actions">
                {student && (
                  <>
                    <span className="who">
                      <span className="avatar" aria-hidden="true">
                        {firstName(student.name).charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <b>{student.name}</b>
                        <span className="who-class muted"> · {student.className}</span>
                      </span>
                    </span>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={signOut}>
                      Đăng xuất
                    </button>
                  </>
                )}
              </div>
            </header>
            <main id="app" tabIndex={-1}>
              {children}
            </main>
            <footer className="site-footer">
              <span>
                {settings.centerName || "TEDU English"} · Better English, Brighter Futures
                {settings.contact ? ` · ${settings.contact}` : ""}
              </span>
              <nav aria-label="Liên kết cuối trang">
                <Link href="/">Trang học tập</Link>
                <Link href="/admin">Khu vực giáo viên</Link>
              </nav>
            </footer>
          </div>
        </div>
        {docId && <DocReader id={docId} onClose={closeDoc} />}
      </div>
      <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>
        {toastMsg}
      </div>
    </Ctx.Provider>
  );
}
