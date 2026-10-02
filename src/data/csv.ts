import type { Row } from "./generate";

/** Turns rows into CSV text (quotes values that contain commas, quotes or newlines). */
export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

export function downloadCsv(name: string, rows: Row[]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }); // BOM so Excel shows Bangla correctly
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Small CSV parser: handles quoted fields, "" escapes and CRLF. Numeric-looking columns become numbers. */
export function parseCsv(text: string, maxRows = 20000): Row[] {
  const records: string[][] = [];
  let field = "";
  let rec: string[] = [];
  let inQ = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      rec.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      rec.push(field);
      field = "";
      if (rec.some((x) => x !== "")) records.push(rec);
      rec = [];
      if (records.length > maxRows) break;
    } else field += ch;
  }
  if (field !== "" || rec.length) {
    rec.push(field);
    if (rec.some((x) => x !== "")) records.push(rec);
  }
  if (records.length < 2) return [];
  const header = records[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const body = records.slice(1);
  const numeric = header.map((_, j) => body.every((r) => (r[j] ?? "").trim() === "" || isFinite(Number((r[j] ?? "").replace(/,/g, "")))));
  return body.map((r) => {
    const row: Row = {};
    header.forEach((h, j) => {
      const raw = (r[j] ?? "").trim();
      row[h] = raw === "" ? null : numeric[j] ? Number(raw.replace(/,/g, "")) : raw;
    });
    return row;
  });
}
