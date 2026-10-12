// Excel / CSV export for Vessel Operations reports (SheetJS + file-saver).
// Times are written as text in the place's local time and in UTC, so they open exactly as shown on screen
// whatever the time zone of the computer that opens the file. Zero stays 0 (never an empty cell).
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 'YYYY-MM-DD' → '05-Jul-2026'
export function dateText(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m, day] = d.split("-");
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}

function parts(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

// Instant → '05-Jul-2026 11:30' in the zone / in UTC ('' when empty)
export const ltText = (iso, timeZone) => (iso ? parts(iso, timeZone || "UTC") || "" : "");
export const utcText = (iso) => (iso ? parts(iso, "UTC") || "" : "");

const cellValue = (v) => (v === null || v === undefined ? "" : v);

function sheetFrom(rows, columns) {
  // columns: [{ key | value(row), header }]
  const data = [columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => cellValue(c.value ? c.value(r) : r[c.key])))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = columns.map((c, i) => ({ wch: Math.min(60, Math.max(8, ...data.slice(0, 300).map((row) => String(row[i] ?? "").length + 2))) }));
  if (rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }) };
  return ws;
}

// sheets: [{ name, rows, columns }] — or { name, aoa } for free layout. CSV writes the first sheet.
export function exportReport(filename, sheets, format = "xlsx") {
  if (format === "csv") {
    const s = sheets[0];
    const ws = s.aoa ? XLSX.utils.aoa_to_sheet(s.aoa) : sheetFrom(s.rows, s.columns);
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = s.aoa ? XLSX.utils.aoa_to_sheet(s.aoa) : sheetFrom(s.rows, s.columns);
    if (s.aoa && s.widths) ws["!cols"] = s.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
