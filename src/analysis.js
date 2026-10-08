/**
 * Summaries of epiworldjs output tables. These port the helpers of
 * epiworldRShiny's measles app (inst/models/shiny_measles.R): tabulator,
 * get_takehome_stats, aggregate_active_cases and analyze_hospitalizations.
 */

/** Quantile of sorted values, R's default (type 7). */
export function quantile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function mean(values) {
  let s = 0;
  for (const v of values) s += v;
  return values.length ? s / values.length : NaN;
}

/**
 * Final outbreak size (agents ever infected) of each simulation: the value
 * on the last recorded day.
 *
 * @param {{sim_id: ArrayLike<number>, date: ArrayLike<number>, outbreak_size: ArrayLike<number>}} table
 * @param {number} nsims
 * @returns {Float64Array}
 */
export function finalOutbreakSizes(table, nsims) {
  const out = new Float64Array(nsims);
  const last = new Float64Array(nsims).fill(-Infinity);
  for (let i = 0; i < table.sim_id.length; i++) {
    const s = table.sim_id[i];
    if (table.date[i] >= last[s]) {
      last[s] = table.date[i];
      out[s] = table.outbreak_size[i];
    }
  }
  return out;
}

/**
 * Hospitalizations per simulation: the sum of `weight` per sim; simulations
 * without rows count as 0 (analyze_hospitalizations).
 *
 * @param {{sim_id: ArrayLike<number>, weight: ArrayLike<number>}} table
 * @param {number} nsims
 * @returns {Float64Array}
 */
export function hospitalizationsPerSim(table, nsims) {
  const out = new Float64Array(nsims);
  if (!table) return out;
  for (let i = 0; i < table.sim_id.length; i++) out[table.sim_id[i]] += table.weight[i];
  return out;
}

/**
 * Mean and 95% interval of per-simulation values.
 *
 * @param {ArrayLike<number>} values
 */
export function describe(values) {
  const sorted = Float64Array.from(values).sort();
  return {
    mean: mean(sorted),
    median: quantile(sorted, 0.5),
    lower: quantile(sorted, 0.025),
    upper: quantile(sorted, 0.975),
  };
}

/**
 * Probability that the final outbreak size reaches each threshold
 * (tabulator).
 *
 * @param {ArrayLike<number>} sizes Final outbreak sizes.
 * @param {number[]} thresholds
 * @returns {number[]}
 */
export function exceedanceProbabilities(sizes, thresholds) {
  return thresholds.map((t) => {
    let k = 0;
    for (const s of sizes) if (s >= t) k++;
    return sizes.length ? k / sizes.length : NaN;
  });
}

/** Formats a probability as the Shiny app does: "< 1%" at or below 1%. */
export function formatProbability(p) {
  if (!Number.isFinite(p)) return "–";
  return p <= 0.01 ? "< 1%" : `${Math.round(p * 100)}%`;
}

/**
 * Active cases per day across simulations: median, 50% and 95% intervals,
 * with days a simulation did not record counted as 0
 * (aggregate_active_cases).
 *
 * @param {{sim_id: ArrayLike<number>, date: ArrayLike<number>, active_cases: ArrayLike<number>}} table
 * @param {number} nsims
 * @param {number} ndays
 * @returns {{day: number, median: number, lower: number, upper: number, q25: number, q75: number}[]}
 */
export function activeCasesBand(table, nsims, ndays) {
  const values = Array.from({ length: ndays + 1 }, () => new Float64Array(nsims));
  for (let i = 0; i < table.sim_id.length; i++) {
    const d = table.date[i];
    if (d >= 0 && d <= ndays) values[d][table.sim_id[i]] = table.active_cases[i];
  }
  return values.map((v, day) => {
    const sorted = v.sort();
    return {
      day,
      median: quantile(sorted, 0.5),
      lower: quantile(sorted, 0.025),
      upper: quantile(sorted, 0.975),
      q25: quantile(sorted, 0.25),
      q75: quantile(sorted, 0.75),
    };
  });
}

/**
 * Probability that the final outbreak size reaches at least x, for every x
 * where it changes: [{x, p}] with x increasing from 1 and p decreasing.
 *
 * @param {ArrayLike<number>} sizes Final outbreak sizes.
 * @returns {{x: number, p: number}[]}
 */
export function exceedanceCurve(sizes) {
  const sorted = Float64Array.from(sizes).sort();
  const n = sorted.length;
  const out = [{ x: 1, p: n ? sorted.filter((s) => s >= 1).length / n : NaN }];
  for (let i = 0; i < n; i++) {
    if (sorted[i] > 1 && sorted[i] !== sorted[i - 1]) out.push({ x: sorted[i], p: (n - i) / n });
  }
  // Ends at zero just past the largest outbreak
  if (n) out.push({ x: sorted[n - 1] + 1, p: 0 });
  return out;
}

/** Probability that the outbreak reaches at least x, read off an exceedance curve. */
export function exceedanceAt(curve, x) {
  let p = curve.length ? curve[0].p : NaN;
  for (const point of curve) {
    if (point.x > x) break;
    p = point.p;
  }
  return p;
}

/**
 * Everything the results panel shows for one scenario.
 *
 * @param {import("epiworldjs").Result | {tables: object, spec: {nsims?: number, ndays?: number}}} result
 */
export function summarizeScenario(result) {
  const nsims = result.spec.nsims ?? 1;
  const ndays = result.spec.ndays ?? 100;
  const sizes = finalOutbreakSizes(result.tables.outbreak_size, nsims);
  const hosp = hospitalizationsPerSim(result.tables.hospitalizations, nsims);
  return {
    nsims,
    ndays,
    sizes,
    hospitalizations: hosp,
    outbreak: describe(sizes),
    hosp: describe(hosp),
    curve: activeCasesBand(result.tables.active_cases, nsims, ndays),
    exceedance: exceedanceCurve(sizes),
  };
}

/**
 * Default outbreak-size thresholds: the Shiny app's for a school, scaled
 * for larger populations.
 *
 * @param {number} n Population size.
 */
export function defaultThresholds(n) {
  if (n <= 1000) return [2, 10, 25, 50, 80];
  // Five "nice" values from 10 up to a fifth of the population, spread out
  const nice = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]
    .filter((t) => t <= n * 0.2);
  if (nice.length <= 5) return nice;
  return [0, 1, 2, 3, 4].map((k) => nice[Math.round((k * (nice.length - 1)) / 4)]);
}
