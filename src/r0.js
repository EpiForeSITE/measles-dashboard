/**
 * Calibration of contact rates from the basic reproductive number, R0.
 *
 * MeaslesSchool (fully mixed): only prodromal agents are infectious, and
 * each one is contacted by `contact rate` agents a day on average, so
 *
 *   R0 = contact_rate × transmission_rate × prodromal_period.
 *
 * MeaslesMixing: a susceptible agent in group i contacts each infectious
 * agent in group j with probability C[i][j] / N_j. Agents with rash are
 * infectious too, with contacts scaled by r = 1 − "Rash reduction contact
 * rate". Stages last a lognormal number of days (see stagePmf()). Each day
 * with rash, an agent is hospitalized with probability h (the hospitalization
 * rate); otherwise it recovers when its rash period R ends. So it is still
 * in rash on day k if R ≥ k and it was not hospitalized before, and the
 * expected infectious period is D = E[prodromal] + r Σ_k P(R ≥ k) (1 − h)^(k − 1).
 * The
 * next-generation matrix is K[i][j] = p × D × C[i][j] × N_i / N_j, which is
 * similar to p × D × C, hence
 *
 *   R0 = p × D × ρ(C),
 *
 * with ρ the spectral radius. Calibrating a matrix to a target R0 scales it
 * by R0 / (p × D × ρ(C)), which keeps its shape (who mixes with whom).
 */

/**
 * @param {number} r0
 * @param {number} transmissionRate
 * @param {number} prodromalPeriod
 */
export function schoolContactRate(r0, transmissionRate, prodromalPeriod) {
  return r0 / (transmissionRate * prodromalPeriod);
}

/**
 * @param {number} contactRate
 * @param {number} transmissionRate
 * @param {number} prodromalPeriod
 */
export function schoolR0(contactRate, transmissionRate, prodromalPeriod) {
  return contactRate * transmissionRate * prodromalPeriod;
}

/** Standard normal CDF (erf by Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
function normalCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Probability that a measles stage lasts d days, d = 1, ..., dmax (entry
 * d − 1), as the measles models draw it: a lognormal with this mean and sd
 * (in days), rounded to whole days with a minimum of one. An sd of 0 is a
 * fixed duration.
 *
 * @param {number} mean
 * @param {number} sd
 * @param {number} [dmax]
 * @returns {number[]}
 */
export function stagePmf(mean, sd, dmax = 200) {
  const pmf = new Array(dmax).fill(0);
  if (!(sd > 0) || !(mean > 0)) {
    pmf[Math.max(1, Math.round(mean)) - 1] = 1;
    return pmf;
  }
  const s2 = Math.log(1 + (sd * sd) / (mean * mean));
  const mu = Math.log(mean) - s2 / 2;
  let prev = 0;
  for (let d = 1; d <= dmax; d++) {
    const cdf = normalCdf((Math.log(d + 0.5) - mu) / Math.sqrt(s2));
    pmf[d - 1] = cdf - prev;
    prev = cdf;
  }
  return pmf;
}

/**
 * Mean days an agent is infectious in the mixing model, weighting days with
 * rash by their relative contact rate.
 *
 * @param {object} v
 * @param {number} v.prodromalPeriod
 * @param {number} v.prodromalSd
 * @param {number} v.rashPeriod
 * @param {number} v.rashSd
 * @param {number} v.rashContactReduction epiworld's "Rash reduction contact
 *   rate": 1 means agents with rash make no contacts.
 * @param {number} v.hospitalizationRate Daily probability that an agent with
 *   rash is hospitalized (which ends its contacts).
 */
export function mixingInfectiousPeriod({ prodromalPeriod, prodromalSd, rashPeriod, rashSd, rashContactReduction, hospitalizationRate }) {
  const prodromal = stagePmf(prodromalPeriod, prodromalSd).reduce((a, p, i) => a + p * (i + 1), 0);
  let rashDays = 0;
  let atLeast = 1; // P(rash period ≥ k)
  let stay = 1;    // (1 − h)^(k − 1)
  for (const p of stagePmf(rashPeriod, rashSd)) {
    rashDays += atLeast * stay;
    atLeast -= p;
    stay *= 1 - hospitalizationRate;
  }
  return prodromal + (1 - rashContactReduction) * rashDays;
}

/**
 * Spectral radius of a non-negative square matrix, by power iteration. For
 * non-negative matrices the Perron root is real and equals the spectral
 * radius; a small shift keeps the iteration from oscillating on periodic
 * (e.g., bipartite) matrices.
 *
 * @param {number[][]} m
 * @returns {number}
 */
export function spectralRadius(m) {
  const n = m.length;
  if (n === 0) return 0;
  const shift = 1;
  let v = new Array(n).fill(1 / n);
  let lambda = 0;
  for (let iter = 0; iter < 10000; iter++) {
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = shift * v[i];
      for (let j = 0; j < n; j++) s += m[i][j] * v[j];
      w[i] = s;
    }
    const norm = w.reduce((a, b) => a + b, 0);
    if (norm === 0) return 0;
    for (let i = 0; i < n; i++) w[i] /= norm;
    const next = norm - shift; // since sum(v) = 1
    const diff = Math.max(...w.map((x, i) => Math.abs(x - v[i])));
    v = w;
    if (Math.abs(next - lambda) < 1e-13 * Math.max(1, Math.abs(next)) && diff < 1e-12) return next;
    lambda = next;
  }
  return lambda;
}

/**
 * R0 implied by a contact matrix.
 *
 * @param {number[][]} matrix Daily contacts, [i][j] = of group i with group j.
 * @param {number} transmissionRate
 * @param {number} infectiousPeriod From `mixingInfectiousPeriod()`.
 */
export function mixingR0(matrix, transmissionRate, infectiousPeriod) {
  return transmissionRate * infectiousPeriod * spectralRadius(matrix);
}

/**
 * Scales `matrix` so that it implies R0 = `r0`.
 *
 * @param {number[][]} matrix
 * @param {number} r0
 * @param {number} transmissionRate
 * @param {number} infectiousPeriod
 * @returns {{matrix: number[][], factor: number}}
 */
export function calibrateMatrix(matrix, r0, transmissionRate, infectiousPeriod) {
  const rho = spectralRadius(matrix);
  if (!(rho > 0)) throw new Error("The contact matrix has no contacts (its spectral radius is 0).");
  const factor = r0 / (transmissionRate * infectiousPeriod * rho);
  return { matrix: matrix.map((row) => row.map((x) => x * factor)), factor };
}

/**
 * Effective reproductive number at the start, given vaccination.
 *
 * @param {number} r0
 * @param {number} propVaccinated
 * @param {number} vaxEfficacy
 */
export function effectiveR(r0, propVaccinated, vaxEfficacy) {
  return r0 * (1 - propVaccinated * vaxEfficacy);
}

/** Proportion immune needed to stop sustained spread: 1 − 1/R0. */
export function herdImmunityThreshold(r0) {
  return r0 > 1 ? 1 - 1 / r0 : 0;
}
