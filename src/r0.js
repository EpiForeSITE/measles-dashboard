/**
 * Calibration of contact rates from the basic reproductive number, R0.
 *
 * MeaslesSchool (fully mixed): only prodromal agents are infectious, and
 * each one is contacted by `contact rate` agents a day on average, so
 *
 *   R0 = contact_rate × transmission_rate × E[prodromal period],
 *
 * with the expected prodromal period of the drawn (rounded) durations.
 *
 * MeaslesMixing: a susceptible agent in group i contacts each infectious
 * agent in group j with probability C[i][j] / N_j. Agents with rash are
 * infectious too, with contacts scaled by r = 1 − "Rash reduction contact
 * rate". Stages last a lognormal number of days (see stageSurvival()). Each day
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
 * Mean days a school agent is infectious: its expected prodromal period.
 *
 * @param {{prodromalPeriod: number, prodromalSd: number}} v
 */
export function schoolInfectiousPeriod({ prodromalPeriod, prodromalSd }) {
  return expectedStageDays(prodromalPeriod, prodromalSd);
}

/**
 * Contact rate that gives the target R0 in the school model.
 *
 * @param {{r0: number, transmissionRate: number, prodromalPeriod: number, prodromalSd: number}} v
 */
export function schoolContactRate(v) {
  return v.r0 / (v.transmissionRate * schoolInfectiousPeriod(v));
}

/**
 * @param {number} contactRate
 * @param {number} transmissionRate
 * @param {number} infectiousPeriod From `schoolInfectiousPeriod()`.
 */
export function schoolR0(contactRate, transmissionRate, infectiousPeriod) {
  return contactRate * transmissionRate * infectiousPeriod;
}

/**
 * erfc(x), with fractional error below 1.2e-7 everywhere (Numerical Recipes'
 * erfcc), so that tail probabilities keep their relative accuracy.
 */
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** P(Z > z) for a standard normal Z. */
const normalUpper = (z) => 0.5 * erfc(z / Math.SQRT2);

/** Parameters of the lognormal with this mean and sd (natural scale). */
function lognormal(mean, sd) {
  const s2 = Math.log(1 + (sd * sd) / (mean * mean));
  return { mu: Math.log(mean) - s2 / 2, s: Math.sqrt(s2) };
}

/**
 * P(D ≥ d) for a stage duration D as the measles models draw it: a lognormal
 * X with this mean and sd (in days), rounded to whole days with a minimum of
 * one, so D ≥ d (d ≥ 2) when X ≥ d − 0.5. An sd of 0 is a fixed duration.
 *
 * @param {number} mean
 * @param {number} sd
 * @param {number} d
 */
export function stageSurvival(mean, sd, d) {
  if (d <= 1) return 1;
  if (!(sd > 0) || !(mean > 0)) return d <= Math.max(1, Math.round(mean)) ? 1 : 0;
  const { mu, s } = lognormal(mean, sd);
  return normalUpper((Math.log(d - 0.5) - mu) / s);
}

/** E[(X − c)+] for the lognormal X with this mean and sd. */
function lognormalExcess(mean, sd, c) {
  if (!(sd > 0) || !(mean > 0)) return Math.max(0, Math.max(1, Math.round(mean)) - c);
  const { mu, s } = lognormal(mean, sd);
  const z = (Math.log(c) - mu) / s;
  return mean * normalUpper(z - s) - c * normalUpper(z);
}

/**
 * Expected days an agent spends in a stage of duration D (see
 * stageSurvival()) when, each day, it leaves early with probability h:
 * Σ_k P(D ≥ k) (1 − h)^(k − 1). With h = 0, this is E[D].
 *
 * The sum runs to day 1000, and the rest is the lognormal tail
 * (1 − h)^1000 E[(X − 1000.5)+], with an error below
 * (1 − h)^1000 P(X > 1000.5) days (under 1e-4 days for a mean of 4 and an
 * sd of 30, the largest the inputs allow).
 *
 * @param {number} mean
 * @param {number} sd
 * @param {number} [h]
 */
export function expectedStageDays(mean, sd, h = 0) {
  const K = 1000;
  let days = 0;
  let stay = 1; // (1 − h)^(k − 1)
  for (let k = 1; k <= K; k++) {
    days += stageSurvival(mean, sd, k) * stay;
    stay *= 1 - h;
  }
  return days + stay * lognormalExcess(mean, sd, K + 0.5);
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
  return expectedStageDays(prodromalPeriod, prodromalSd) +
    (1 - rashContactReduction) * expectedStageDays(rashPeriod, rashSd, hospitalizationRate);
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
