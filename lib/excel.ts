"use client";

import { noMarks } from "@/convex/model";

export type ClassListRow = { name: string; className: string; phone: string };
export type ClassList = { rows: ClassListRow[]; sheet: string; columns: { name: string; className: string | null; phone: string | null } };

const norm = (v: unknown) => noMarks(String(v ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
const cellText = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toLocaleDateString("vi-VN") : String(v)).trim();

/** Finds the header row and the name / class / phone columns in a pasted or uploaded class list. */
export function detectColumns(table: unknown[][]) {
  for (let r = 0; r < Math.min(table.length, 15); r++) {
    const cells = table[r].map(norm);
    const find = (test: (c: string) => boolean) => cells.findIndex(test);
    // Some sheets split "Họ (và tên đệm)" and "Tên".
    const last = find((c) => c === "ten");
    const first = find((c) => /^ho( va ten dem| va ten lot| dem| lot| va dem)?$/.test(c));
    const split = last >= 0 && first >= 0;
    let name = split ? first : find((c) => /ho (va )?ten|ten hoc sinh|ho ten hs|^ten hs$|^name$|full name|student name/.test(c));
    if (name < 0 && last >= 0) name = last;
    if (name < 0 && !split) continue;
    return {
      headerRow: r,
      name: split ? first : name,
      nameLast: split ? last : -1,
      className: find((c) => /^(ten )?lop( hoc)?$|^class|lop$/.test(c)),
      phone: find((c) => /dien thoai|^sdt|so dt|phone|^dt$|zalo/.test(c)),
    };
  }
  return null;
}

export function tableToClassList(table: unknown[][], sheet = ""): ClassList {
  const cols = detectColumns(table);
  // No recognisable header: first column is the name, second the class.
  const c = cols ?? { headerRow: -1, name: 0, nameLast: -1, className: 1, phone: -1 };
  const header = cols ? table[cols.headerRow].map(cellText) : [];
  const rows: ClassListRow[] = [];
  for (const row of table.slice(c.headerRow + 1)) {
    const name = [cellText(row[c.name]), c.nameLast >= 0 ? cellText(row[c.nameLast]) : ""].filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (!name || /^\d/.test(name) || /^(tong|cong|stt)\b/.test(norm(name)) || /^(tong|cong)\b/.test(norm(row[0]))) continue;
    rows.push({
      name,
      className: c.className >= 0 ? cellText(row[c.className]) : "",
      phone: c.phone >= 0 ? cellText(row[c.phone]) : "",
    });
  }
  return {
    rows,
    sheet,
    columns: {
      name: cols ? [header[c.name], c.nameLast >= 0 ? header[c.nameLast] : ""].filter(Boolean).join(" + ") : "Cột A",
      className: c.className >= 0 ? (cols ? header[c.className] : "Cột B") : null,
      phone: c.phone >= 0 ? header[c.phone] : null,
    },
  };
}

/** Reads the first sheet that contains a class list. Everything happens in the browser. */
export async function readClassList(file: File): Promise<ClassList> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Chỉ đọc được file .xlsx. Với file .xls cũ, mở bằng Excel rồi “Lưu thành” .xlsx.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File Excel tối đa 10 MB.");
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  const lists = sheets.map((s) => tableToClassList(s.data as unknown[][], s.sheet));
  const best = lists.find((l) => l.rows.length && l.columns.className !== "Cột B") ?? lists.find((l) => l.rows.length);
  if (!best) throw new Error("Không tìm thấy học sinh nào trong file. Kiểm tra file có cột “Họ và tên”.");
  return best;
}

export async function downloadXlsx(fileName: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const data = [header.map((h) => ({ value: h, fontWeight: "bold" as const })), ...rows.map((r) => r.map((v) => ({ value: v ?? "" })))];
  await writeXlsxFile(data, { columns: header.map((h, i) => ({ width: Math.max(12, h.length + 2, ...rows.map((r) => String(r[i] ?? "").length + 2)) })), stickyRowsCount: 1 }).toFile(fileName);
}
