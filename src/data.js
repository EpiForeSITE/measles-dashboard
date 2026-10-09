/**
 * Data the dashboard ships with: schools (vaccination coverage), population
 * presets for the mixing model, and the parameter reference table. All are
 * plain JSON files under `data/`, so new states or presets need no code
 * changes.
 */

import { resolveAsset } from "./config.js";
import { parseCSVRecords } from "./csv.js";

const cache = new Map();

async function fetchJSON(path) {
  const url = resolveAsset(path);
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
      return r.json();
    }).catch((error) => { cache.delete(url); throw error; }));
  }
  return cache.get(url);
}

/**
 * @typedef {object} School
 * @property {string} state
 * @property {string} county
 * @property {string} name
 * @property {string} id
 * @property {number} rate Vaccination rate in [0, 1].
 * @property {number | null} size Enrollment, when known.
 */

/**
 * A source of schools: the bundled per-state files, or an uploaded CSV.
 *
 * @typedef {object} SchoolSource
 * @property {() => Promise<string[]>} states
 * @property {(state: string) => Promise<string[]>} counties
 * @property {(state: string, county?: string) => Promise<School[]>} schools
 *   Schools of a state, or of one county when `county` is given.
 */

/** @returns {SchoolSource} */
export function bundledSchools() {
  const load = (state) => fetchJSON(`data/schools/${encodeURIComponent(state)}.json`);
  return {
    async states() {
      return (await fetchJSON("data/schools/index.json")).states.map((s) => s.code);
    },
    async counties(state) {
      return (await load(state)).counties;
    },
    async schools(state, county) {
      const data = await load(state);
      const k = county ? data.counties.indexOf(county) : -1;
      return data.schools
        .filter((row) => !county || row[0] === k)
        .map(([c, name, id, rate, size]) => ({ state, county: data.counties[c], name, id, rate, size: size ?? null }));
    },
  };
}

export const UPLOAD_LIMITS = { maxBytes: 5 * 1024 * 1024, maxRows: 10000 };
export const REQUIRED_COLUMNS = ["state", "county", "school_name", "school_id", "vaccination_rate", "num_students"];

const isMissing = (s) => s === undefined || /^\s*(|NA|N\/A|null)\s*$/i.test(s);

/**
 * Validates and parses an uploaded school CSV with the rules of
 * epiworldRShiny's validate_school_csv (R/school-selector.R).
 *
 * @param {string} text
 * @returns {School[]}
 * @throws {Error} With a message for the user.
 */
export function parseSchoolCSV(text) {
  const { columns, records } = parseCSVRecords(text);
  if (!REQUIRED_COLUMNS.every((c) => columns.includes(c)))
    throw new Error(`CSV must contain columns: ${REQUIRED_COLUMNS.join(", ")}`);
  if (records.length > UPLOAD_LIMITS.maxRows)
    throw new Error(`CSV contains too many schools. Maximum ${UPLOAD_LIMITS.maxRows} schools allowed.`);

  return records.map((r) => {
    const rate = isMissing(r.vaccination_rate) ? NaN : Number(r.vaccination_rate);
    if (!isMissing(r.vaccination_rate) && !(rate >= 0 && rate <= 1))
      throw new Error("vaccination_rate must be numeric values between 0 and 1");
    let size = null;
    if (!isMissing(r.num_students)) {
      size = Number(r.num_students);
      if (!(size >= 0 && size <= 50000))
        throw new Error("num_students must be numeric values between 0 and 50000, or NA when enrollment data is unavailable");
      size = Math.round(size);
    }
    return { state: r.state.trim(), county: r.county.trim(), name: r.school_name.trim(), id: r.school_id.trim(), rate, size };
  });
}

/**
 * @param {School[]} rows
 * @returns {SchoolSource}
 */
export function uploadedSchools(rows) {
  const sorted = (xs) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
  return {
    async states() { return sorted(rows.map((r) => r.state)); },
    async counties(state) { return sorted(rows.filter((r) => r.state === state).map((r) => r.county)); },
    async schools(state, county) {
      return rows.filter((r) => r.state === state && (!county || r.county === county))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

/**
 * @typedef {object} PopulationPreset
 * @property {string} id
 * @property {string} name
 * @property {string} [source]
 * @property {string} [notes]
 * @property {{name: string, size: number}[]} groups
 * @property {number[][]} contact_matrix Daily contacts; [i][j] = of a person
 *   in group i with people in group j.
 */

/** @returns {Promise<{id: string, name: string, file: string}[]>} */
export async function populationIndex() {
  return (await fetchJSON("data/populations/index.json")).presets;
}

/** @returns {Promise<PopulationPreset>} */
export async function loadPopulation(file) {
  const preset = await fetchJSON(`data/populations/${file}`);
  const errors = validatePopulation(preset);
  if (errors.length) throw new Error(`Invalid population preset ${file}: ${errors.join(" ")}`);
  return preset;
}

/**
 * A row of the "Model assumptions & references" table
 * (data/parameters.json, written by scripts/sync-parameters.mjs from the
 * measles package's canonical parameter table).
 *
 * @typedef {object} ParameterRow
 * @property {string} parameter The dashboard's name.
 * @property {string | null} input Key in params.js, when it is an input.
 * @property {{school?: string, community?: string}} value Value used by each model (for inputs, the default).
 * @property {string} source
 * @property {string} url
 * @property {string} notes Provenance details, shown after the source.
 */

/** @returns {Promise<{table: string, vignette: string, parameters: ParameterRow[]}>} */
export async function loadParameters() {
  return fetchJSON("data/parameters.json");
}

/**
 * Checks a population (preset or edited) for the mixing model.
 *
 * @param {PopulationPreset} p
 * @returns {string[]} Error messages (empty when valid).
 */
export function validatePopulation(p) {
  const errors = [];
  if (!p || !Array.isArray(p.groups) || p.groups.length === 0) return ["There must be at least one group."];
  const g = p.groups.length;
  p.groups.forEach((group, i) => {
    if (!(Number.isInteger(group.size) && group.size > 0))
      errors.push(`Group ${i + 1} (${group.name || "unnamed"}) must have a whole, positive size.`);
  });
  const m = p.contact_matrix;
  if (!Array.isArray(m) || m.length !== g || m.some((row) => !Array.isArray(row) || row.length !== g)) {
    errors.push(`The contact matrix must be ${g} × ${g}.`);
  } else if (m.some((row) => row.some((x) => !(Number.isFinite(x) && x >= 0)))) {
    errors.push("Contact matrix entries must be non-negative numbers.");
  } else if (m.every((row) => row.every((x) => x === 0))) {
    errors.push("The contact matrix has no contacts.");
  }
  return errors;
}

const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Schools whose name or county contain every word of `query` (ignoring case
 * and accents), names starting with the query first.
 *
 * @param {School[]} schools
 * @param {string} query
 * @param {number} [limit]
 * @returns {School[]}
 */
export function searchSchools(schools, query, limit = 50) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return schools.slice(0, limit);
  const out = [];
  for (const s of schools) {
    const name = fold(s.name);
    const text = `${name} ${fold(s.county)}`;
    if (words.every((w) => text.includes(w))) out.push({ s, rank: name.startsWith(words[0]) ? 0 : 1 });
  }
  out.sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name));
  return out.slice(0, limit).map((x) => x.s);
}
