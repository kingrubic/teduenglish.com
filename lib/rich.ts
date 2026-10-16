/*
 * Question text is stored with light markup: [b]bold[/b], [u]underline[/u] (they can nest).
 * Teachers never see it: the editor shows the formatting and converts back and forth here.
 */

export type Run = { text: string; b: boolean; u: boolean };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Stored markup → HTML for the editor (only <b>, <u> and <br>). */
export function markupToHtml(markup: string): string {
  return escapeHtml(markup)
    .replace(/\[(\/?)([bu])\]/g, "<$1$2>")
    .replace(/\n/g, "<br>");
}

/** Formatted runs (from the editor) → stored markup; neighbouring runs with the same style are merged. */
export function runsToMarkup(runs: Run[]): string {
  const merged: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = merged[merged.length - 1];
    // Line breaks carry no formatting, so they never split a bold/underlined stretch.
    if (last && ((last.b === r.b && last.u === r.u) || r.text === "\n")) last.text += r.text;
    else merged.push({ ...r });
  }
  return merged
    .map((r) => {
      // Keep spaces at the edges outside the tags: "[b]word[/b] " reads better than "[b]word [/b]".
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.text)!;
      if (!m[2] || (!r.b && !r.u)) return r.text;
      let inner = m[2];
      if (r.u) inner = `[u]${inner}[/u]`;
      if (r.b) inner = `[b]${inner}[/b]`;
      return m[1] + inner + m[3];
    })
    .join("");
}

/** Markup → plain text (for previews, speech, search). */
export function plainText(markup: string): string {
  return markup.replace(/\[\/?[bu]\]/g, "");
}
