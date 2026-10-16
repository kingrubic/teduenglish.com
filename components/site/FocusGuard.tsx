"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/*
 * Guarded tests: leaving the page (another tab, app or browser window) warns once with a 5-second
 * countdown; a second time, or staying away too long, submits the work and locks the account.
 * The server keeps the count and enforces the deadline; this component detects leaving and shows it.
 */

let paused = 0;
/** Runs `fn` (e.g. window.confirm) without it counting as leaving the test. */
export function withGuardPaused<T>(fn: () => T): T {
  paused++;
  try {
    return fn();
  } finally {
    setTimeout(() => paused--, 800);
  }
}

const isAway = () => document.visibilityState === "hidden" || !document.hasFocus();

type Phase = { kind: "idle" } | { kind: "away"; until: number } | { kind: "back" } | { kind: "locked" };

export default function FocusGuard({
  id,
  token,
  used,
  snapshot,
  onLocked,
  onSignOut,
}: {
  id: string;
  token: string;
  /** Warnings already used on this test (from the server). */
  used: number;
  /** Current answers and elapsed seconds, sent along so a lock can submit them. */
  snapshot: () => { answers: Record<string, string | number>; durationSec: number };
  onLocked: () => void;
  onSignOut: () => void;
}) {
  const awayMut = useMutation(api.guard.away);
  const backMut = useMutation(api.guard.back);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const [warned, setWarned] = useState(used);
  const busy = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const snap = useRef(snapshot);
  const locked = useRef(onLocked);
  useEffect(() => {
    snap.current = snapshot;
    locked.current = onLocked;
  });

  // Sound needs a user gesture first; any click on the page will do.
  useEffect(() => {
    const init = () => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audio.current ??= new Ctx();
      } catch {
        /* no sound */
      }
    };
    document.addEventListener("pointerdown", init, { once: true });
    return () => document.removeEventListener("pointerdown", init);
  }, []);

  function beep() {
    const ctx = audio.current;
    if (!ctx) return;
    ctx.resume().catch(() => {});
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 988;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  }

  // Detect leaving. Hidden (other tab, app on phones) counts at once; losing focus (another window
  // or app on a computer) after a short moment, so a stray click doesn't count.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function left(leftAt: number) {
      if (busy.current || paused > 0 || !isAway()) return;
      busy.current = true;
      const { answers, durationSec } = snap.current();
      try {
        const r = await awayMut({ token, id, answers, durationSec, awayMs: Date.now() - leftAt });
        if (r.status === "off") return;
        if (r.status === "locked") {
          setPhase({ kind: "locked" });
          locked.current();
          return;
        }
        setWarned(1);
        const until = leftAt + r.seconds * 1000;
        setPhase({ kind: "away", until });
        beep();
        // Wait for the student to come back.
        await new Promise<void>((resolve) => {
          const t = setInterval(() => {
            setNow(Date.now());
            if (!isAway()) {
              clearInterval(t);
              resolve();
            }
          }, 200);
        });
        const b = await backMut({ token, eventId: r.eventId as Id<"focusEvents">, awayMs: Date.now() - leftAt });
        if (b.status === "locked") {
          setPhase({ kind: "locked" });
          locked.current();
        } else setPhase({ kind: "back" });
      } catch {
        /* offline: nothing we can enforce from here */
      } finally {
        busy.current = false;
      }
    }

    const onHidden = () => {
      if (document.visibilityState === "hidden") left(Date.now());
    };
    const onBlur = () => {
      const at = Date.now();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => left(at), 600);
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onHidden);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [awayMut, backMut, id, token]);

  // Flash the tab title while away so the student notices from another tab.
  useEffect(() => {
    if (phase.kind !== "away") return;
    const original = document.title;
    let on = false;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? "⚠️ QUAY LẠI BÀI NGAY!" : original;
    }, 700);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [phase.kind]);

  const banner = (
    <p className={`guard-banner${warned ? " used" : ""}`} role="note">
      🔒 <b>Bài có giám sát:</b> không chuyển tab, không mở ứng dụng hay trình duyệt khác cho đến khi nộp bài.{" "}
      {warned ? <b>Em đã dùng hết lần cảnh báo: rời bài lần nữa là tài khoản bị khoá ngay.</b> : "Lần đầu được cảnh báo 5 giây để quay lại, lần thứ hai tài khoản bị khoá."}
    </p>
  );

  let overlay: React.ReactNode = null;
  if (phase.kind === "away") {
    const left = Math.max(0, Math.ceil((phase.until - now) / 1000));
    overlay = (
      <div className="guard-overlay danger" role="alertdialog" aria-live="assertive" aria-label="Cảnh báo rời bài">
        <div className="guard-box">
          <p className="guard-icon">⚠️</p>
          <h2>Em vừa rời khỏi bài!</h2>
          <p className="guard-count">{left}</p>
          <p>Quay lại trang này ngay. Hết {5} giây mà chưa quay lại, bài sẽ được nộp và tài khoản bị khoá.</p>
        </div>
      </div>
    );
  } else if (phase.kind === "back")
    overlay = (
      <div className="guard-overlay" role="alertdialog" aria-label="Cảnh báo">
        <div className="guard-box">
          <p className="guard-icon">✋</p>
          <h2>Đây là lần cảnh báo duy nhất</h2>
          <p>Em đã quay lại kịp. Từ giờ đến khi nộp bài, nếu em chuyển tab hoặc mở ứng dụng khác, tài khoản sẽ bị khoá ngay.</p>
          <button className="btn btn-primary" type="button" autoFocus onClick={() => setPhase({ kind: "idle" })}>
            Em hiểu, làm bài tiếp
          </button>
        </div>
      </div>
    );
  else if (phase.kind === "locked")
    overlay = (
      <div className="guard-overlay danger" role="alertdialog" aria-label="Tài khoản bị khoá">
        <div className="guard-box">
          <p className="guard-icon">🔒</p>
          <h2>Tài khoản đã bị khoá</h2>
          <p>Em đã rời khỏi bài khi đang làm. Phần bài em làm đến lúc đó đã được gửi cho thầy cô. Em liên hệ thầy cô để được mở lại tài khoản.</p>
          <button className="btn btn-primary" type="button" autoFocus onClick={onSignOut}>
            Đã hiểu
          </button>
        </div>
      </div>
    );

  return (
    <>
      {banner}
      {overlay && createPortal(overlay, document.body)}
    </>
  );
}
