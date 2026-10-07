/**
 * Minimal RFC 4180 CSV parsing and writing, shared by the browser (school
 * uploads, downloads) and the data build script.
 */

/**
 * Parses CSV text into an array of rows (arrays of strings). Handles quoted
 * fields, escaped quotes ("") and CRLF line endings. Blank lines are skipped.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/**
 * Parses CSV text with a header row into objects keyed by column name.
 *
 * @param {string} text
 * @returns {{columns: string[], records: Object<string, string>[]}}
 */
export function parseCSVRecords(text) {
  const [header = [], ...rows] = parseCSV(text.replace(/^﻿/, ""));
  const columns = header.map((h) => h.trim());
  const records = rows.map((r) => Object.fromEntries(columns.map((c, j) => [c, r[j] ?? ""])));
  return { columns, records };
}

function quote(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * @param {string[]} columns
 * @param {Array<Array<unknown>>} rows
 */
export function toCSV(columns, rows) {
  return [columns, ...rows].map((r) => r.map(quote).join(",")).join("\n") + "\n";
}
