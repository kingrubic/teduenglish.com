"use client";

import { noMarks } from "@/convex/model";

export type ClassListRow = { name: string; className: string; phone: string; code: string };
/** Column indexes in a sheet; -1 when absent. `nameLast` is set when "Họ" and "Tên" are split. */
export type Columns = { name: number; nameLast: number; className: number; phone: number; code: number };
export type SheetTable = { sheet: string; headers: string[]; body: unknown[][]; cols: Columns; hasHeader: boolean };

const norm = (v: unknown) => noMarks(String(v ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
const cellText = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toLocaleDateString("vi-VN") : String(v)).trim();
/** Phone cell as text; "4 số cuối" columns typed as numbers lose leading zeros (48 → "0048"). */
function lastDigits(v: unknown): string {
  const t = cellText(v);
  const d = t.replace(/\D/g, "");
  return d.length > 0 && d.length < 4 && /^\d+$/.test(t) ? d.padStart(4, "0") : t;
}
const looksLikePhone = (v: unknown) => /^(\+?84|0)?\d{9,10}$/.test(String(v ?? "").replace(/[\s.\-()]/g, ""));

const NAME = /ho (va )?ten|ten hoc sinh|ho ten hs|^ten hs$|^name$|full name|student name/;
const CLASS = /^(ten )?lop( hoc)?$|^class|lop$/;
const PHONE = /dien thoai|sdt|so dt|^dt\b|phone|zalo|lien he|lien lac|mobile|di dong|^tel|so cuoi/;
const CODE = /^(ma|ma (hoc sinh|hs|ca nhan|moi|dang nhap|truy cap|so))$|^(student )?code$/;

/** Finds the header row and the name / class / phone / existing-code columns. */
export function detectColumns(table: unknown[][]): (Columns & { headerRow: number }) | null {
  for (let r = 0; r < Math.min(table.length, 15); r++) {
    const cells = table[r].map(norm);
    const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
    // Some sheets split "Họ (và tên đệm)" and "Tên".
    const last = cells.findIndex((c) => c === "ten");
    const first = find(/^ho( va ten dem| va ten lot| dem| lot| va dem)?$/);
    const split = last >= 0 && first >= 0;
    let name = split ? first : find(NAME);
    if (name < 0 && last >= 0) name = last;
    if (name < 0) continue;
    return { headerRow: r, name, nameLast: split ? last : -1, className: find(CLASS), phone: find(PHONE), code: find(CODE) };
  }
  return null;
}

/** Column whose filled cells are mostly phone numbers, whatever its header says. */
function guessPhoneColumn(body: unknown[][], skip: number[]): number {
  const width = Math.max(0, ...body.map((r) => r.length));
  for (let c = 0; c < width; c++) {
    if (skip.includes(c)) continue;
    const vals = body.map((r) => r[c]).filter((v) => cellText(v) !== "");
    if (vals.length >= 2 && vals.filter(looksLikePhone).length / vals.length >= 0.6) return c;
  }
  return -1;
}

export function analyzeTable(table: unknown[][], sheet = ""): SheetTable {
  const found = detectColumns(table);
  const headerRow = found?.headerRow ?? -1;
  const body = table.slice(headerRow + 1);
  // No recognisable header: first column is the name, second the class.
  const cols: Columns = found ?? { name: 0, nameLast: -1, className: 1, phone: -1, code: -1 };
  if (cols.phone < 0) cols.phone = guessPhoneColumn(body, [cols.name, cols.nameLast, cols.className, cols.code]);
  const width = Math.max(0, ...table.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (found ? cellText(table[headerRow][i]) : "") || `Cột ${String.fromCharCode(65 + i)}`);
  return { sheet, headers, body, cols, hasHeader: !!found };
}

export function rowsFrom(t: SheetTable, cols: Columns = t.cols): ClassListRow[] {
  const rows: ClassListRow[] = [];
  for (const row of t.body) {
    const name = [cellText(row[cols.name]), cols.nameLast >= 0 ? cellText(row[cols.nameLast]) : ""].filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (!name || /^\d/.test(name) || /^(tong|cong|stt)\b/.test(norm(name)) || /^(tong|cong)\b/.test(norm(row[0]))) continue;
    rows.push({
      name,
      className: cols.className >= 0 ? cellText(row[cols.className]) : "",
      phone: cols.phone >= 0 ? lastDigits(row[cols.phone]) : "",
      code: cols.code >= 0 ? cellText(row[cols.code]) : "",
    });
  }
  return rows;
}

/** Convenience for tests and simple callers. */
export function tableToClassList(table: unknown[][], sheet = "") {
  const t = analyzeTable(table, sheet);
  const label = (i: number) => (i >= 0 ? t.headers[i] : null);
  return {
    rows: rowsFrom(t),
    sheet,
    columns: {
      name: [t.headers[t.cols.name], t.cols.nameLast >= 0 ? t.headers[t.cols.nameLast] : ""].filter(Boolean).join(" + "),
      className: label(t.cols.className),
      phone: label(t.cols.phone),
      code: label(t.cols.code),
    },
  };
}

/** Reads the sheet that holds the class list. Everything happens in the browser. */
export async function readClassList(file: File): Promise<SheetTable> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Chỉ đọc được file .xlsx. Với file .xls cũ, mở bằng Excel rồi “Lưu thành” .xlsx.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File Excel tối đa 10 MB.");
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = (await readXlsxFile(file)).map((s) => analyzeTable(s.data as unknown[][], s.sheet));
  const best = sheets.find((t) => t.hasHeader && rowsFrom(t).length) ?? sheets.find((t) => rowsFrom(t).length);
  if (!best) throw new Error("Không tìm thấy học sinh nào trong file. Kiểm tra file có cột “Họ và tên”.");
  return best;
}

export async function downloadXlsx(fileName: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const data = [header.map((h) => ({ value: h, fontWeight: "bold" as const })), ...rows.map((r) => r.map((v) => ({ value: v ?? "" })))];
  await writeXlsxFile(data, { columns: header.map((h, i) => ({ width: Math.max(12, h.length + 2, ...rows.map((r) => String(r[i] ?? "").length + 2)) })), stickyRowsCount: 1 }).toFile(fileName);
}
