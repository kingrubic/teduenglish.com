"use client";

import { ConvexError } from "convex/values";
import { Fragment, type ReactNode } from "react";

/* ---------- storage (always safe to fail) ---------- */
type Area = "localStorage" | "sessionStorage";
export function sget<T>(area: Area, key: string, fallback: T): T {
  try {
    const v = window[area].getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function sset(area: Area, key: string, value: unknown) {
  try {
    window[area].setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
export function sdel(area: Area, key: string) {
  try {
    window[area].removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Human-readable message from a Convex mutation failure. */
export function errMsg(e: unknown, fallback = "Có lỗi xảy ra, vui lòng thử lại."): string {
  if (e instanceof ConvexError) return String(e.data);
  if (e instanceof Error && /network|fetch|connection/i.test(e.message)) return "Mất kết nối mạng. Kiểm tra internet rồi thử lại.";
  return fallback;
}

/** Hide the splash screen once the first real data is on screen. */
export function signalReady() {
  const w = window as unknown as { __teduReady?: boolean };
  if (w.__teduReady) return;
  w.__teduReady = true;
  window.dispatchEvent(new Event("tedu:ready"));
}

function pad(n: number) {
  return (n < 10 ? "0" : "") + n;
}
export function stamp(d: Date | number = new Date()) {
  const x = typeof d === "number" ? new Date(d) : d;
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function safeUrl(u: string) {
  return /^https?:\/\//i.test(u) ? u : "#";
}

/** Saves a cross-origin file under its real name; falls back to opening it. */
export async function downloadFile(url: string, name: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export function copyText(text: string, onOk: () => void, onFail: () => void) {
  try {
    navigator.clipboard.writeText(text).then(onOk, onFail);
  } catch {
    onFail();
  }
}

/** Renders [u]..[/u] as underline and [b]..[/b] as bold (nesting allowed), everything else as plain text. */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[(u|b)\]([\s\S]+?)\[\/\1\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    const inner = <Rich text={m[2]} />;
    parts.push(m[1] === "u" ? <u key={k++}>{inner}</u> : <strong key={k++}>{inner}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}

export function plain(s: string) {
  return s.replace(/\[\/?[ub]\]/g, "");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
