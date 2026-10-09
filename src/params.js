/**
 * Inputs of the two simulators: labels, defaults, limits and tooltips.
 *
 * The school inputs and their texts follow epiworldRShiny's measles panel
 * (inst/models/shiny_measles.R), except that the contact rate is replaced by
 * R0 (see r0.js). Keys are the dashboard's own names; specs.js maps them to
 * epiworld parameter names.
 *
 * Tooltips end with a short source. The full table, with every value, the
 * measles package's default and the citation, is public/data/parameters.json
 * (built by scripts/sync-parameters.mjs, shown under "Model assumptions &
 * references"); run `npm run parameters` after changing a default here.
 */

/**
 * @typedef {object} InputDef
 * @property {string} key
 * @property {string} label
 * @property {"number" | "slider"} type
 * @property {number} value Default.
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {boolean} [integer]
 * @property {boolean} [optional] Empty is allowed (e.g., the seed).
 * @property {"percent"} [format] Show a 0–1 value as a percentage.
 * @property {string} [unit] Shown after the value, e.g. "days".
 * @property {string} tooltip
 * @property {"main" | "quarantine" | "advanced"} section
 */

/** @type {InputDef[]} */
const COMMON = [
  { key: "initialCases", label: "Initial cases", type: "number", value: 1, min: 1, step: 1, integer: true, section: "main",
    tooltip: "# of people infected with measles at the start of the simulation. Source: scenario input." },
  { key: "propVaccinated", label: "Vaccinated", type: "slider", value: 0.85, min: 0, max: 1, step: 0.01, format: "percent", section: "main",
    tooltip: "Proportion of people who are vaccinated against measles. Source: scenario input (default from epiworldRShiny); school data from epiENGAGE and Utah DHHS." },
  { key: "ndays", label: "Simulation time", type: "number", unit: "days", value: 100, min: 0, max: 1000, step: 1, integer: true, section: "main",
    tooltip: "# of days to run the simulation" },

  { key: "quarantineWillingness", label: "Quarantine willingness", type: "slider", value: 1, min: 0, max: 1, step: 0.01, format: "percent", section: "quarantine",
    tooltip: "How willing people are to stay home when asked to quarantine (1 = 100% willing, 0 = 0% willing). Source: assumption (field experience)." },
  { key: "daysUndetected", label: "Days undetected", type: "number", unit: "days", value: 2, min: 0, max: 60, step: 0.5, section: "quarantine",
    tooltip: "Average # of days after the rash manifests before a person is detected as infected with measles. Source: assumption (about 2 days to public health notification)." },
  { key: "quarantineDays", label: "Quarantine length", type: "number", unit: "days", value: 21, min: 0, max: 60, step: 1, integer: true, section: "quarantine",
    tooltip: "# of days after potential exposure a quarantined person will stay home, if willing. This is a fixed value, not an average, and is the same for all quarantined individuals. 21 days is the CDC recommendation for measles quarantine. Source: Utah DHHS Measles Disease Plan." },
  { key: "isolationDays", label: "Isolation length", type: "number", unit: "days", value: 4, min: 0, max: 60, step: 1, integer: true, section: "quarantine",
    tooltip: "# of days an infected person is isolated after rash is detected. This is a fixed value, not an average, and is the same for all isolated individuals. Source: Utah DHHS Measles Disease Plan (isolate until 4 days after rash onset)." },

  { key: "r0", label: "R0 (basic reproductive number)", type: "number", value: 15, min: 0, max: 40, step: 0.5, section: "advanced",
    tooltip: "Average # of people one case infects in a fully susceptible population. Measles is usually quoted at 12–18. The contact rate is calibrated to match this value given the transmission probability and the infectious period. Source: Guerra et al. 2017, Lancet Infect Dis." },
  { key: "hospitalizationDuration", label: "Hospitalization duration", type: "number", unit: "days", value: 7, min: 1, max: 60, step: 1, section: "advanced",
    tooltip: "Average # of days an infected person is hospitalized. Source: assumption (observed stays are shorter, about 2 days)." },
  { key: "nsims", label: "Simulations", type: "number", value: 200, min: 1, max: 1000, step: 1, integer: true, section: "advanced",
    tooltip: "# of simulations to run - displayed results are summarized across all simulations" },
  { key: "hospitalizationRate", label: "Hospitalization rate", type: "slider", value: 0.2, min: 0, max: 1, step: 0.01, format: "percent", section: "advanced",
    tooltip: "Daily rate at which a person with rash is hospitalized (a rate, not a probability). The chance of hospitalization is h / (h + 1/rash period): with 20% a day and a 3-day rash, about 37.5%. Source: conservative value agreed with Utah DHHS." },
  { key: "transmissionRate", label: "Transmission probability", type: "slider", value: 0.99, min: 0.01, max: 1, step: 0.01, format: "percent", section: "advanced",
    tooltip: "The chance an infected individual transmits the disease to a contacted susceptible individual. Fixed high, with the contact rate calibrated to R0. Source: assumption (epiworldRShiny default; the measles package uses 90%)." },
  { key: "vaxEfficacy", label: "Vaccine efficacy", type: "slider", value: 0.97, min: 0, max: 1, step: 0.01, format: "percent", section: "advanced",
    tooltip: "How effective the vaccine (2 doses of MMR) is at preventing infection. Source: Utah DHHS Measles Disease Plan (~97%)." },
  { key: "incubationDays", label: "Incubation period", type: "number", unit: "days", value: 12, min: 1, max: 60, step: 1, section: "advanced",
    tooltip: "Average # of days the disease incubates before the individual becomes symptomatic. Source: Utah DHHS Measles Disease Plan." },
  { key: "prodromalPeriod", label: "Prodromal period", type: "number", unit: "days", value: 4, min: 1, max: 60, step: 1, section: "advanced",
    tooltip: "Average # of days the prodromal (infectious, pre-rash) period lasts before the individual develops a rash. Source: Utah DHHS Measles Disease Plan." },
  { key: "rashPeriod", label: "Rash period", type: "number", unit: "days", value: 3, min: 1, max: 60, step: 1, section: "advanced",
    tooltip: "Average # of days the rash lasts before the individual recovers (the infectious part of the rash). Source: Utah DHHS Measles Disease Plan." },
];

const SEED = { key: "seed", label: "Random seed", type: "number", value: 2023, min: 0, step: 1, integer: true, optional: true, section: "advanced",
  tooltip: "Random seed for the simulation, use a specific seed to reproduce results" };

/** Inputs of the school model (MeaslesSchool). */
export const SCHOOL_INPUTS = [
  { key: "populationSize", label: "Students", type: "number", value: 500, min: 1, max: 50000, step: 1, integer: true, section: "main",
    tooltip: "# of students in the school. Source: scenario input." },
  ...COMMON.map((d) => d.key === "initialCases"
    ? { ...d, tooltip: "# of students infected with measles at the start of the simulation. Source: scenario input." }
    : d.key === "propVaccinated"
      ? { ...d, tooltip: "Proportion of students in the school who are vaccinated against measles. Source: scenario input (default from epiworldRShiny); school data from epiENGAGE and Utah DHHS." }
      : d),
  SEED,
];

/** Inputs of the community model (MeaslesMixing); the population comes from the group editor. */
export const MIXING_INPUTS = [
  ...COMMON.map((d) => d.key === "ndays" ? { ...d, value: 180 } : d),
  { key: "isolationWillingness", label: "Isolation willingness", type: "slider", value: 1, min: 0, max: 1, step: 0.01, format: "percent", section: "quarantine",
    tooltip: "Probability that a detected case complies with isolation. Source: assumption (field experience)." },
  { key: "contactTracingSuccessRate", label: "Contact tracing success", type: "slider", value: 1, min: 0, max: 1, step: 0.01, format: "percent", section: "quarantine",
    tooltip: "Probability that a contact of a detected case is traced (and asked to quarantine). Source: assumption (field experience)." },
  { key: "contactTracingDaysWindow", label: "Contact tracing window", type: "number", unit: "days", value: 4, min: 0, max: 30, step: 1, integer: true, section: "quarantine",
    tooltip: "# of days before rash detection whose contacts are traced. Source: assumption (field experience), matching the Utah DHHS Measles Disease Plan exposure window." },
  { key: "rashContactReduction", label: "Rash contact reduction", type: "slider", value: 1, min: 0, max: 1, step: 0.01, format: "percent", section: "advanced",
    tooltip: "How much people with rash reduce their contacts (1 = they stay home and make no contacts, 0 = no change). Lower values make the rash period infectious and raise the calibrated contact rates. Source: assumption." },
  SEED,
];

/** @param {InputDef[]} inputs */
export function defaults(inputs) {
  return Object.fromEntries(inputs.map((d) => [d.key, d.value]));
}

/**
 * Checks values against their definitions.
 *
 * @param {InputDef[]} inputs
 * @param {Object<string, number | null>} values
 * @returns {string[]} Error messages (empty when valid).
 */
export function validate(inputs, values) {
  const errors = [];
  for (const d of inputs) {
    const v = values[d.key];
    if (v === null || v === undefined || Number.isNaN(v)) {
      if (!d.optional) errors.push(`${d.label} is required.`);
      continue;
    }
    if (d.min !== undefined && v < d.min) errors.push(`${d.label} must be at least ${d.min}.`);
    if (d.max !== undefined && v > d.max) errors.push(`${d.label} must be at most ${d.max}.`);
    if (d.integer && !Number.isInteger(v)) errors.push(`${d.label} must be a whole number.`);
  }
  return errors;
}
