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
 * rate". Each day an agent with rash recovers (probability 1 / rash period)
 * or is hospitalized (the hospitalization rate), so it spends on average
 * 1 / (1 / rash + h) days with rash, and the expected infectious period is
 * D = prodromal + r / (1 / rash + h). The
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

/**
 * Mean days an agent is infectious in the mixing model, weighting days with
 * rash by their relative contact rate.
 *
 * @param {number} prodromalPeriod
 * @param {number} rashPeriod
 * @param {number} rashContactReduction epiworld's "Rash reduction contact
 *   rate": 1 means agents with rash make no contacts.
 * @param {number} hospitalizationRate Daily probability that an agent with
 *   rash is hospitalized (which ends its contacts).
 */
export function mixingInfectiousPeriod(prodromalPeriod, rashPeriod, rashContactReduction, hospitalizationRate) {
  const leaveRash = Math.min(1, 1 / rashPeriod + hospitalizationRate);
  return prodromalPeriod + (1 - rashContactReduction) / leaveRash;
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
