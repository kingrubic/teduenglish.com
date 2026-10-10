/*
 * Pure helpers shared by Convex functions and the Next.js client.
 * No Convex imports here so the browser bundle can use them too.
 */

export type McqQuestion = {
  type: "mcq";
  tag?: string;
  q: string;
  options: string[];
  answer: number;
  explain?: string;
};
export type FillQuestion = {
  type: "fill";
  tag?: string;
  q: string;
  answer: string[];
  explain?: string;
};
export type Question = McqQuestion | FillQuestion;
export type Section = {
  title: string;
  listen?: string;
  passage?: string;
  questions: Question[];
};
export type IeltsKind = "listening" | "reading";
export type AnswerValue = string | number;
export type Answers = Record<string, AnswerValue>;

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function normCode(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function normAnswer(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[.!?;,]+$/g, "")
    .trim();
}

export function noMarks(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function firstName(full: unknown): string {
  const parts = String(full ?? "").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

export function slugify(s: unknown): string {
  return noMarks(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function questionCount(sections: { questions: unknown[] }[]): number {
  return sections.reduce((n, s) => n + s.questions.length, 0);
}

export function isAnswered(q: Question, v: AnswerValue | undefined): boolean {
  return q.type === "fill" ? normAnswer(v) !== "" : typeof v === "number";
}

export function isCorrect(q: Question, v: AnswerValue | undefined): boolean {
  if (q.type === "fill") {
    const a = normAnswer(v);
    return a !== "" && q.answer.some((x) => normAnswer(x) === a);
  }
  return v === q.answer;
}

export type GradeResult = {
  correct: number;
  total: number;
  wrong: number;
  unanswered: number;
};

export function grade(sections: Section[], answers: Answers): GradeResult {
  let correct = 0;
  let total = 0;
  let unanswered = 0;
  sections.forEach((sec, si) => {
    sec.questions.forEach((q, qi) => {
      const v = answers[`${si}-${qi}`];
      total++;
      if (!isAnswered(q, v)) unanswered++;
      else if (isCorrect(q, v)) correct++;
    });
  });
  return { correct, total, unanswered, wrong: total - correct - unanswered };
}

// Approximate IELTS conversion after scaling the score to 40 questions.
const BANDS: Record<IeltsKind, [number, number][]> = {
  listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [11, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]],
  reading: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]],
};

export function bandFor(kind: IeltsKind | undefined | null, correct: number, total: number): number | null {
  const table = kind ? BANDS[kind] : undefined;
  if (!table || !total) return null;
  const scaled = Math.round((correct / total) * 40);
  for (const [min, band] of table) if (scaled >= min) return band;
  return 0;
}

/** Returns a list of problems with a quiz definition; empty when valid. */
export function validateSections(sections: Section[]): string[] {
  const errors: string[] = [];
  if (!sections.length) errors.push("Bài cần ít nhất một phần (section).");
  let num = 0;
  sections.forEach((sec, si) => {
    if (!sec.questions.length) errors.push(`Phần ${si + 1} chưa có câu hỏi.`);
    sec.questions.forEach((q) => {
      num++;
      if (!q.q.trim()) errors.push(`Câu ${num}: chưa nhập nội dung câu hỏi.`);
      if (q.type === "mcq") {
        const opts = q.options.filter((o) => o.trim());
        if (opts.length < 2) errors.push(`Câu ${num}: cần ít nhất 2 lựa chọn.`);
        if (opts.length !== q.options.length) errors.push(`Câu ${num}: có lựa chọn đang để trống.`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
          errors.push(`Câu ${num}: chưa chọn đáp án đúng.`);
      } else if (!q.answer.some((a) => normAnswer(a))) {
        errors.push(`Câu ${num}: cần ít nhất một đáp án được chấp nhận.`);
      }
    });
  });
  return errors;
}
