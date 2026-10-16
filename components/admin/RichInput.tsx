"use client";

import { useEffect, useRef, useState } from "react";
import { markupToHtml, runsToMarkup, type Run } from "@/lib/rich";

const BLOCKS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "TR"]);
const SKIP = new Set(["STYLE", "SCRIPT", "HEAD", "META", "TITLE", "XML"]);

/**
 * Editor DOM → formatted runs. Handles <b>/<u>, their CSS equivalents (pasted from Word or Docs) and line breaks.
 * `pasted`: HTML source text, where newlines and indentation are only layout and collapse to one space.
 */
function domToRuns(root: Node, pasted = false): Run[] {
  const runs: Run[] = [];
  const nl = () => {
    const last = runs[runs.length - 1];
    if (last && !last.text.endsWith("\n")) runs.push({ text: "\n", b: false, u: false });
  };
  const walk = (node: Node, b: boolean, u: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent ?? "";
      if (pasted) text = text.replace(/\s+/g, " ");
      runs.push({ text: text.replace(/\u00a0/g, " "), b, u });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toUpperCase();
    if (SKIP.has(tag) || tag.includes(":")) return; // Word's <o:p> and friends
    if (tag === "BR") {
      runs.push({ text: "\n", b: false, u: false });
      return;
    }
    let nb = b;
    let nu = u;
    if (tag === "B" || tag === "STRONG") nb = true;
    if (tag === "U") nu = true;
    const fw = node.style.fontWeight;
    if (fw === "bold" || Number(fw) >= 600) nb = true;
    else if (fw === "normal" || (fw && Number(fw) < 600)) nb = false;
    const td = node.style.textDecorationLine || node.style.textDecoration;
    if (td.includes("underline")) nu = true;
    else if (td === "none") nu = false;
    const block = BLOCKS.has(tag) && node !== root;
    if (block) nl();
    node.childNodes.forEach((c) => walk(c, nb, nu));
    if (block) nl();
  };
  walk(root, false, false);
  return runs;
}

function serialize(el: HTMLElement, multiline: boolean) {
  let out = runsToMarkup(domToRuns(el)).replace(/\n+$/, "");
  if (!multiline) out = out.replace(/\n/g, " ");
  return out;
}

/**
 * Text box that shows bold and underline as they will look to students (no codes to type).
 * Select words, then press B or U (or Ctrl/⌘+B, Ctrl/⌘+U); "___" inserts a blank.
 * The value is stored as [b]…[/b] / [u]…[/u] markup.
 */
export default function RichInput({
  id,
  value,
  onChange,
  multiline = true,
  rows = 2,
  placeholder,
  label,
  blank = true,
}: {
  id?: string;
  value: string;
  onChange: (markup: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  label: string;
  blank?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const [active, setActive] = useState({ b: false, u: false });
  const [focused, setFocused] = useState(false);

  // Only rewrite the DOM when the value changes from outside (loading a quiz, JSON import…).
  useEffect(() => {
    const el = ref.current;
    if (el && value !== emitted.current) {
      el.innerHTML = markupToHtml(value);
      emitted.current = value;
    }
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const next = serialize(el, multiline);
    emitted.current = next;
    if (next !== value) onChange(next);
  }

  function refreshActive() {
    try {
      setActive({ b: document.queryCommandState("bold"), u: document.queryCommandState("underline") });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!focused) return;
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [focused]);

  function command(cmd: "bold" | "underline") {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd);
    emit();
    refreshActive();
  }

  function insertBlank() {
    ref.current?.focus();
    document.execCommand("insertText", false, "___");
    emit();
  }

  function clearFormat() {
    ref.current?.focus();
    document.execCommand("removeFormat");
    emit();
    refreshActive();
  }

  return (
    <div
      className={`rich-input${focused ? " focused" : ""}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="rich-tools" role="toolbar" aria-label={`Định dạng: ${label}`}>
        <button type="button" className={active.b ? "on" : ""} aria-pressed={active.b} title="In đậm (Ctrl/⌘ + B)" onMouseDown={(e) => e.preventDefault()} onClick={() => command("bold")}>
          <b>B</b>
          <span>In đậm</span>
        </button>
        <button type="button" className={active.u ? "on" : ""} aria-pressed={active.u} title="Gạch chân (Ctrl/⌘ + U)" onMouseDown={(e) => e.preventDefault()} onClick={() => command("underline")}>
          <u>U</u>
          <span>Gạch chân</span>
        </button>
        {blank && (
          <button type="button" title="Chèn chỗ trống ___" onMouseDown={(e) => e.preventDefault()} onClick={insertBlank}>
            <b>___</b>
            <span>Chỗ trống</span>
          </button>
        )}
        <button type="button" title="Bỏ đậm và gạch chân ở đoạn đã chọn" onMouseDown={(e) => e.preventDefault()} onClick={clearFormat}>
          <span className="clear">Bỏ định dạng</span>
        </button>
      </div>
      <div
        ref={ref}
        id={id}
        className={`rich-area${multiline ? "" : " single"}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        aria-label={label}
        data-placeholder={placeholder ?? ""}
        style={multiline ? { minHeight: `${rows * 1.6 + 1.2}em` } : undefined}
        spellCheck={false}
        onInput={emit}
        onFocus={refreshActive}
        onBlur={() => {
          // Tidy anything a paste or the browser left behind.
          const el = ref.current;
          if (el) {
            const clean = serialize(el, multiline);
            el.innerHTML = markupToHtml(clean);
            emitted.current = clean;
            if (clean !== value) onChange(clean);
          }
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === "Enter") e.preventDefault();
          const mod = e.metaKey || e.ctrlKey;
          if (mod && (e.key === "b" || e.key === "B")) {
            e.preventDefault();
            command("bold");
          } else if (mod && (e.key === "u" || e.key === "U")) {
            e.preventDefault();
            command("underline");
          } else if (mod && (e.key === "i" || e.key === "I")) e.preventDefault(); // italic isn't stored
        }}
        onPaste={(e) => {
          // Keep bold/underline from Word or Google Docs, drop everything else.
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          e.preventDefault();
          if (html) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const markup = runsToMarkup(domToRuns(doc.body, true)).replace(/ *\n */g, "\n").trim();
            document.execCommand("insertHTML", false, markupToHtml(multiline ? markup : markup.replace(/\n/g, " ")));
          } else document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
          emit();
        }}
      />
    </div>
  );
}
