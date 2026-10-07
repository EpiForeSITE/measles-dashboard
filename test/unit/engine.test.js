// Runs the dashboard's specs through epiworldjs (WebAssembly, in Node).

import { Epiworld } from "epiworldjs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { summarizeScenario } from "../../src/analysis.js";
import { defaults, MIXING_INPUTS, SCHOOL_INPUTS } from "../../src/params.js";
import { mixingSpec, schoolSpec } from "../../src/specs.js";

let ew;
beforeAll(async () => { ew = await Epiworld.load({ workers: 2 }); });
afterAll(() => ew?.terminate());

const THREE_GROUPS = {
  groups: [{ name: "A", size: 3000 }, { name: "B", size: 3000 }, { name: "C", size: 3000 }],
  contact_matrix: [[13.5, 0.75, 0.75], [1.5, 12, 1.5], [1.5, 3, 10.5]],
};

/** Counts per state on day 0 of simulation 0. */
async function dayZero(spec) {
  const r = await ew.run({ ...spec, nsims: 1, ndays: 0, outputs: ["total_hist"] });
  const { sim_id, date, state, counts } = r.tables.total_hist;
  const out = {};
  for (let i = 0; i < counts.length; i++) if (sim_id[i] === 0 && date[i] === 0 && counts[i]) out[state[i]] = counts[i];
  return out;
}

describe("specs are accepted and set up the population", () => {
  test("school: n and initial cases", async () => {
    for (const k of [1, 3, 7]) {
      const counts = await dayZero(schoolSpec({ ...defaults(SCHOOL_INPUTS), initialCases: k, populationSize: 731 }, { quarantine: true }));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(731);
      expect(total - counts.Susceptible).toBe(k);
    }
  });

  test("mixing: n and initial cases (no floating-point loss)", async () => {
    for (const k of [1, 3, 7, 29]) {
      const counts = await dayZero(mixingSpec({ ...defaults(MIXING_INPUTS), initialCases: k }, THREE_GROUPS, { quarantine: true }));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(9000);
      expect(total - counts.Susceptible).toBe(k);
    }
  });
});

test("school defaults: quarantine reduces outbreaks; results are reproducible", async () => {
  const v = defaults(SCHOOL_INPUTS);
  const [without, withQ] = await Promise.all([
    ew.run(schoolSpec(v, { quarantine: false })), ew.run(schoolSpec(v, { quarantine: true }))]);
  const a = summarizeScenario(without), b = summarizeScenario(withQ);
  expect(a.nsims).toBe(200);
  expect(a.curve).toHaveLength(101);
  expect(b.outbreak.mean).toBeLessThan(a.outbreak.mean);
  expect(a.outbreak.mean).toBeGreaterThanOrEqual(1);
  expect(a.outbreak.upper).toBeLessThanOrEqual(500);

  const again = summarizeScenario(await ew.run(schoolSpec(v, { quarantine: false })));
  expect([...again.sizes]).toEqual([...a.sizes]);
});

test("mixing defaults run", async () => {
  const v = { ...defaults(MIXING_INPUTS), nsims: 20 };
  const s = summarizeScenario(await ew.run(mixingSpec(v, THREE_GROUPS, { quarantine: true })));
  expect(s.sizes).toHaveLength(20);
  expect(s.outbreak.upper).toBeLessThanOrEqual(9000);
});

// The calibration in r0.js against the simulated number of secondary cases
// of the index cases. Short incubation and many index cases in a large
// population keep depletion and truncation small; the tolerance covers what
// is left plus sampling error (about 3% with 1000 index cases).
describe("R0 calibration matches simulated secondary cases", () => {
  const base = { propVaccinated: 0, incubationDays: 2, initialCases: 25, ndays: 18, nsims: 40, seed: 5 };
  const noIsolation = (spec) => ({ ...spec, params: { ...spec.params, "Isolation period": -1 }, outputs: ["reproductive"] });
  const BIG = {
    groups: [{ name: "A", size: 50000 }, { name: "B", size: 30000 }, { name: "C", size: 20000 }],
    contact_matrix: THREE_GROUPS.contact_matrix,
  };
  const indexR = ({ rt, source, source_exposure_date }) => {
    let s = 0, k = 0;
    for (let i = 0; i < rt.length; i++)
      if (source_exposure_date[i] === 0 && source[i] >= 0) { s += rt[i]; k++; }
    expect(k).toBe(base.initialCases * base.nsims);
    return s / k;
  };

  for (const r0 of [5, 12]) {
    test(`school, R0 = ${r0}`, async () => {
      const v = { ...defaults(SCHOOL_INPUTS), ...base, r0, populationSize: 100000 };
      const r = await ew.run(noIsolation(schoolSpec(v, { quarantine: false })));
      expect(indexR(r.tables.reproductive) / r0).toBeGreaterThan(0.9);
      expect(indexR(r.tables.reproductive) / r0).toBeLessThan(1.1);
    });
    for (const rash of [1, 0.5]) {
      test(`mixing, R0 = ${r0}, rash contact reduction = ${rash}`, async () => {
        const v = { ...defaults(MIXING_INPUTS), ...base, r0, rashContactReduction: rash };
        const r = await ew.run(noIsolation(mixingSpec(v, BIG, { quarantine: false })));
        const ratio = indexR(r.tables.reproductive) / r0;
        expect(ratio).toBeGreaterThan(0.9);
        expect(ratio).toBeLessThan(1.1);
      });
    }
  }
});
