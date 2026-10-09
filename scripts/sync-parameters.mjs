// Builds public/data/parameters.json, the table behind the "Model
// assumptions & references" disclosure, from the canonical parameter table
// of the measles R package (inst/extdata/measles_parameters.csv) and the
// dashboard's own values:
//
//   - Sources come from the CSV.
//   - Values come from the input defaults in src/params.js, the R0
//     calibration in src/r0.js and the default population preset, so they
//     cannot drift from what the dashboard runs.
//   - Notes add provenance (where a value comes from, what it means); the
//     table shows them in the Source cell, after the citation.
//
// Rows of the CSV for models the dashboard does not run (tiered quarantine,
// post-exposure prophylaxis) are left out.
//
// Usage: node scripts/sync-parameters.mjs [path/or/url/to/measles_parameters.csv]
// (default: the CSV on the measles package's main branch)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSVRecords } from "../src/csv.js";
import { MIXING_INPUTS, SCHOOL_INPUTS } from "../src/params.js";
import { herdImmunityThreshold, schoolContactRate } from "../src/r0.js";

const PACKAGE_URL = "https://github.com/UofUEpiBio/measles";
const CSV_URL = `${PACKAGE_URL}/blob/main/inst/extdata/measles_parameters.csv`;
const VIGNETTE_URL = `${PACKAGE_URL}/blob/main/vignettes/parameters.qmd`;
const RAW_CSV_URL = "https://raw.githubusercontent.com/UofUEpiBio/measles/main/inst/extdata/measles_parameters.csv";
const PRESET = "default-3group"; // the community model's default preset (mixing-sim.js)

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? RAW_CSV_URL;
const output = join(root, "public", "data", "parameters.json");

const text = /^https?:/.test(input)
  ? await fetch(input).then((r) => {
    if (!r.ok) throw new Error(`Could not download ${input} (${r.status}); pass a local copy of the CSV instead.`);
    return r.text();
  })
  : readFileSync(input, "utf8");
const { columns, records } = parseCSVRecords(text);
for (const c of ["parameter", "citation", "doi_or_url", "notes"])
  if (!columns.includes(c)) throw new Error(`Missing column "${c}" in ${input}`);
const canonical = new Map(records.map((r) => [r.parameter, r]));

const inputs = { school: SCHOOL_INPUTS, community: MIXING_INPUTS };
const def = (model, key) => {
  const d = inputs[model].find((x) => x.key === key);
  if (!d) throw new Error(`No input "${key}" in the ${model} model (src/params.js)`);
  return d;
};
const school = (key) => def("school", key).value;

const preset = JSON.parse(readFileSync(join(root, "public", "data", "populations", `${PRESET}.json`), "utf8"));
const presetSize = preset.groups.reduce((a, g) => a + g.size, 0);
const contactRate = schoolContactRate(school("r0"), school("transmissionRate"), school("prodromalPeriod"));

const BOTH = ["school", "community"];
const DASHBOARD_SETTING = { source: "Dashboard setting", notes: "Simulation setting, not an epidemiological parameter." };

/**
 * One row per parameter, in display order.
 *
 * label: the dashboard's name. canonical: the CSV's `parameter`, if any.
 * input: the key in src/params.js, when it is an input (its default is the
 * value). value: {model: text} for values that are not input defaults.
 * unit: overrides the input's unit. source/url/notes override the CSV.
 */
const ROWS = [
  { label: "R0 (basic reproductive number)", canonical: "R0", input: "r0", models: BOTH,
    notes: "Input. The contact rate (school) or contact matrix (community) is calibrated so the model has this R0 (src/r0.js)." },
  { label: "Herd-immunity threshold", canonical: "Herd-immunity threshold", models: BOTH,
    value: Object.fromEntries(BOTH.map((m) => [m, `${Math.round(herdImmunityThreshold(def(m, "r0").value) * 100)}% (1 − 1/R0)`])),
    notes: "Derived from R0 and shown under the R0 input; not a model parameter." },
  { label: "Population size", canonical: "(population size)", models: BOTH,
    value: { school: `${school("populationSize")} students`, community: `${presetSize.toLocaleString("en-US")} (${preset.groups.length} groups, preset ${PRESET})` },
    source: "Scenario input",
    notes: "School: the Students input (default 500, as in epiworldRShiny). Community: the groups of the population editor." },
  { label: "Initial cases", canonical: "(prevalence)", input: "initialCases", models: BOTH,
    notes: "Input. Entered as a number of cases and converted to the model's prevalence." },
  { label: "Vaccinated", canonical: "Vaccination rate", input: "propVaccinated", models: BOTH,
    source: "Scenario input; school coverage from epiENGAGE and Utah DHHS",
    notes: "The default of 0.85 is kept from epiworldRShiny's measles app. Selecting a school replaces it with that school's reported coverage." },
  { label: "Transmission probability", canonical: "Transmission rate", input: "transmissionRate", models: BOTH,
    source: "Assumption: highly transmissible (epiworldRShiny default). Utah DHHS Measles Disease Plan: \"90% of susceptible contacts will develop disease\"",
    notes: "Per contact. Fixed high; the contacts are calibrated to R0 (src/r0.js)." },
  { label: "Contact rate", canonical: "Contact rate", models: ["school"],
    value: { school: `${contactRate.toFixed(2)} contacts per day` },
    notes: `Not an input: R0 / (transmission × prodromal period) = ${school("r0")} / (${school("transmissionRate")} × ${school("prodromalPeriod")}), the epiworldRShiny default.` },
  { label: "Contact matrix", canonical: "(contact matrix)", models: ["community"],
    value: { community: `Preset ${PRESET}, scaled to R0` },
    notes: "Not an input: the preset's matrix (the measles package example) is rescaled so the model has the chosen R0, with infectious period prodromal + (1 − rash contact reduction) / (1/rash + hospitalization rate). Scaling can be turned off." },
  { label: "Rash contact reduction", canonical: "Rash reduction contact rate", input: "rashContactReduction", models: ["community"] },
  { label: "Incubation period", canonical: "Incubation period", input: "incubationDays", models: BOTH },
  { label: "Prodromal period", canonical: "Prodromal period", input: "prodromalPeriod", models: BOTH },
  { label: "Rash period", canonical: "Rash period", input: "rashPeriod", models: BOTH },
  { label: "Vaccine efficacy", canonical: "Vax efficacy", input: "vaxEfficacy", models: BOTH },
  { label: "Hospitalization rate", canonical: "Hospitalization rate", input: "hospitalizationRate", models: BOTH, unit: "per day",
    notes: "A daily rate, not a probability. With a 3-day rash, p = h / (h + 1/rash) = 0.2 / (0.2 + 1/3) ≈ 0.375 (37.5%)." },
  { label: "Hospitalization duration", canonical: "Hospitalization period", input: "hospitalizationDuration", models: BOTH },
  { label: "Days undetected", canonical: "Days undetected", input: "daysUndetected", models: BOTH },
  { label: "Quarantine length", canonical: "Quarantine period", input: "quarantineDays", models: BOTH,
    notes: "Used by the \"with quarantine\" scenario; the \"without quarantine\" scenario turns quarantine off." },
  { label: "Quarantine willingness", canonical: "Quarantine willingness", input: "quarantineWillingness", models: BOTH },
  { label: "Isolation length", canonical: "Isolation period", input: "isolationDays", models: BOTH },
  { label: "Isolation willingness", canonical: "Isolation willingness", input: "isolationWillingness", models: ["community"] },
  { label: "Contact tracing success", canonical: "Contact tracing success rate", input: "contactTracingSuccessRate", models: ["community"] },
  { label: "Contact tracing window", canonical: "Contact tracing days window", input: "contactTracingDaysWindow", models: ["community"] },
  { label: "Vaccine reduction in recovery", canonical: "(IGNORED) Vax improved recovery", models: ["community"],
    value: { community: "Not set (ignored by the model)" } },
  { label: "Simulation time", input: "ndays", models: BOTH, ...DASHBOARD_SETTING },
  { label: "Simulations", input: "nsims", models: BOTH, ...DASHBOARD_SETTING },
  { label: "Random seed", input: "seed", models: BOTH, ...DASHBOARD_SETTING },
];

function value(row, model) {
  if (row.value) return row.value[model];
  const d = def(model, row.input);
  const unit = row.unit ?? d.unit;
  return unit ? `${d.value} ${unit}` : String(d.value);
}

const parameters = ROWS.map((row) => {
  const c = row.canonical ? canonical.get(row.canonical) : undefined;
  if (row.canonical && !c) throw new Error(`"${row.canonical}" is not in the canonical table`);
  return {
    parameter: row.label,
    input: row.input ?? null,
    value: Object.fromEntries(row.models.map((m) => [m, value(row, m)])),
    source: row.source ?? c?.citation ?? "",
    url: row.url ?? c?.doi_or_url ?? "",
    notes: row.notes ?? c?.notes ?? "",
  };
});

writeFileSync(output, JSON.stringify({
  generatedBy: "scripts/sync-parameters.mjs",
  table: CSV_URL,
  vignette: VIGNETTE_URL,
  parameters,
}, null, 2) + "\n");
console.log(`sync-parameters: wrote ${parameters.length} parameters to public/data/parameters.json`);
