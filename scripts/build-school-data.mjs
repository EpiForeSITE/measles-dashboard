// Converts data-raw/schools_measles.csv (from epiworldRShiny's
// inst/extdata/schools_measles.csv) into per-state JSON files that the
// dashboard loads on demand:
//
//   public/data/schools/index.json  {source, states: [{code, n}]}
//   public/data/schools/<ST>.json   {state, counties: [...], schools: [[county index, name, id, rate], ...]}
//
// Vaccination rates are clamped to [0, 1]. num_students is dropped when it
// is empty for every row (as in the current data); otherwise it is kept as a
// fifth element (null when missing).
//
// Usage: node scripts/build-school-data.mjs [path/to/schools.csv]

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSVRecords } from "../src/csv.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? join(root, "data-raw", "schools_measles.csv");
const outDir = join(root, "public", "data", "schools");

const { columns, records } = parseCSVRecords(readFileSync(input, "utf8"));
for (const c of ["state", "county", "school_name", "vaccination_rate", "school_id"])
  if (!columns.includes(c)) throw new Error(`Missing column "${c}" in ${input}`);

const hasSize = records.some((r) => (r.num_students ?? "").trim() !== "");
const byState = new Map();
let clamped = 0, skipped = 0;
for (const r of records) {
  let rate = Number.parseFloat(r.vaccination_rate);
  if (!Number.isFinite(rate)) { skipped++; continue; }
  if (rate < 0 || rate > 1) { clamped++; rate = Math.min(1, Math.max(0, rate)); }
  const state = r.state.trim();
  if (!byState.has(state)) byState.set(state, []);
  const size = Number.parseInt(r.num_students, 10);
  byState.get(state).push({
    county: r.county.trim(), name: r.school_name.trim(), id: r.school_id.trim(),
    rate: Math.round(rate * 1e4) / 1e4, size: Number.isFinite(size) ? size : null,
  });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const states = [];
for (const [state, rows] of [...byState].sort(([a], [b]) => a.localeCompare(b))) {
  rows.sort((a, b) => a.county.localeCompare(b.county) || a.name.localeCompare(b.name));
  const counties = [...new Set(rows.map((r) => r.county))];
  const index = new Map(counties.map((c, i) => [c, i]));
  const schools = rows.map((r) => {
    const row = [index.get(r.county), r.name, r.id, r.rate];
    if (hasSize) row.push(r.size);
    return row;
  });
  writeFileSync(join(outDir, `${state}.json`), JSON.stringify({ state, counties, schools }));
  states.push({ code: state, n: rows.length });
}

writeFileSync(join(outDir, "index.json"), JSON.stringify({
  source: "epiENGAGE / TACC measles-dashboard (https://github.com/TACC/measles-dashboard) and Utah DHHS, via epiworldRShiny",
  hasEnrollment: hasSize,
  states,
}, null, 1));

console.log(`${records.length - skipped} schools in ${states.length} states; ${clamped} rates clamped, ${skipped} rows skipped.`);
