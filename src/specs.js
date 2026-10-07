/**
 * Dashboard inputs → epiworldjs run specs. The UI, the tests and the native
 * comparison (scripts/dump-specs.mjs) all build specs here, so they run
 * exactly the same models.
 */

import { calibrateMatrix, mixingInfectiousPeriod, schoolContactRate } from "./r0.js";

/** Outputs every dashboard run requests. */
export const OUTPUTS = ["active_cases", "outbreak_size", "hospitalizations"];

/** Value of "Quarantine period" that turns quarantine off. */
export const NO_QUARANTINE = -1;

function diseaseParams(v, quarantine) {
  return {
    "Transmission rate": v.transmissionRate,
    "Vax efficacy": v.vaxEfficacy,
    "Vaccination rate": v.propVaccinated,
    "Incubation period": v.incubationDays,
    "Prodromal period": v.prodromalPeriod,
    "Rash period": v.rashPeriod,
    "Hospitalization rate": v.hospitalizationRate,
    "Hospitalization period": v.hospitalizationDuration,
    "Days undetected": v.daysUndetected,
    "Quarantine period": quarantine ? v.quarantineDays : NO_QUARANTINE,
    "Quarantine willingness": v.quarantineWillingness,
    "Isolation period": v.isolationDays,
  };
}

function common(v) {
  return {
    ndays: v.ndays,
    nsims: v.nsims,
    // The seed is optional in the UI; without one, each run is different
    seed: v.seed ?? Math.floor(Math.random() * 2 ** 31),
    outputs: [...OUTPUTS],
  };
}

/**
 * MeaslesSchool spec. The contact rate is calibrated from R0.
 *
 * @param {Object<string, number>} v Values keyed as in params.js SCHOOL_INPUTS.
 * @param {{quarantine: boolean}} options
 */
export function schoolSpec(v, { quarantine }) {
  return {
    model: "MeaslesSchool",
    n: v.populationSize,
    // MeaslesSchool starts with round(prevalence * n) cases
    prevalence: v.initialCases / v.populationSize,
    params: {
      "Contact rate": schoolContactRate(v.r0, v.transmissionRate, v.prodromalPeriod),
      ...diseaseParams(v, quarantine),
    },
    ...common(v),
  };
}

/**
 * The contact matrix a mixing run uses: the population's matrix scaled to
 * R0, or as entered when `calibrate` is false.
 *
 * @param {Object<string, number>} v Values keyed as in params.js MIXING_INPUTS.
 * @param {{contact_matrix: number[][]}} population
 * @param {boolean} [calibrate]
 */
export function mixingMatrix(v, population, calibrate = true) {
  if (!calibrate) return population.contact_matrix;
  const period = mixingInfectiousPeriod(v.prodromalPeriod, v.rashPeriod, v.rashContactReduction, v.hospitalizationRate);
  return calibrateMatrix(population.contact_matrix, v.r0, v.transmissionRate, period).matrix;
}

/**
 * MeaslesMixing spec.
 *
 * @param {Object<string, number>} v Values keyed as in params.js MIXING_INPUTS.
 * @param {{groups: {name: string, size: number}[], contact_matrix: number[][]}} population
 * @param {{quarantine: boolean, calibrate?: boolean}} options
 */
export function mixingSpec(v, population, { quarantine, calibrate = true }) {
  const sizes = population.groups.map((g) => g.size);
  const n = sizes.reduce((a, b) => a + b, 0);
  return {
    model: "MeaslesMixing",
    // The mixing models start with floor(prevalence * n) cases; the half
    // case keeps floating-point error from rounding k/n * n down to k - 1
    prevalence: Math.min(1, (v.initialCases + 0.5) / n),
    population: { type: "groups", sizes, contact_matrix: mixingMatrix(v, population, calibrate) },
    params: {
      ...diseaseParams(v, quarantine),
      "Isolation willingness": v.isolationWillingness,
      "Contact tracing success rate": v.contactTracingSuccessRate,
      "Contact tracing days window": v.contactTracingDaysWindow,
      "Rash reduction contact rate": v.rashContactReduction,
    },
    ...common(v),
  };
}
