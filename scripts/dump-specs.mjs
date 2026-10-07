// Writes the specs that test/native compares between native C++ and
// WebAssembly. They come from the same builders the dashboard uses
// (src/specs.js), so R0 calibration and parameter mapping are covered too.
//
// Output: test/native/specs.json (read by the test) and test/native/specs.txt
// (read by compare.cpp; one "key value" per line, blocks end with "end").

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaults, MIXING_INPUTS, SCHOOL_INPUTS } from "../src/params.js";
import { mixingSpec, schoolSpec } from "../src/specs.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUTS = ["total_hist", "active_cases", "outbreak_size", "hospitalizations", "transition"];

const school = defaults(SCHOOL_INPUTS);
const mixing = defaults(MIXING_INPUTS);
const threeGroups = {
  groups: [{ name: "Group 1", size: 3000 }, { name: "Group 2", size: 3000 }, { name: "Group 3", size: 3000 }],
  contact_matrix: [[13.5, 0.75, 0.75], [1.5, 12, 1.5], [1.5, 3, 10.5]],
};
const fourGroups = {
  groups: [{ name: "0-4", size: 700 }, { name: "5-17", size: 2100 }, { name: "18-64", size: 5200 }, { name: "65+", size: 1500 }],
  contact_matrix: [[3, 2, 4, 0.6], [0.7, 11, 4, 0.4], [0.5, 1.6, 7, 0.9], [0.3, 0.6, 3, 2]],
};

const cases = [
  ["school-default-without", schoolSpec(school, { quarantine: false })],
  ["school-default-with", schoolSpec(school, { quarantine: true })],
  ["school-low-coverage", schoolSpec({ ...school, propVaccinated: 0.62, initialCases: 3, populationSize: 812, r0: 12, seed: 99 }, { quarantine: true })],
  ["school-partial-willingness", schoolSpec({ ...school, quarantineWillingness: 0.4, daysUndetected: 3.5, isolationDays: 6, transmissionRate: 0.8, seed: 7 }, { quarantine: true })],
  ["mixing-default-without", mixingSpec({ ...mixing, nsims: 30 }, threeGroups, { quarantine: false })],
  ["mixing-default-with", mixingSpec({ ...mixing, nsims: 30 }, threeGroups, { quarantine: true })],
  ["mixing-4groups-rash", mixingSpec({ ...mixing, nsims: 20, propVaccinated: 0.7, rashContactReduction: 0.5, contactTracingSuccessRate: 0.6, initialCases: 4, seed: 42 }, fourGroups, { quarantine: true })],
  ["mixing-uncalibrated", mixingSpec({ ...mixing, nsims: 20, seed: 3 }, threeGroups, { quarantine: true, calibrate: false })],
].map(([name, spec]) => ({ name, spec: { ...spec, outputs: OUTPUTS } }));

const lines = [];
for (const { name, spec } of cases) {
  lines.push(`spec ${name}`, `model ${spec.model}`);
  const n = spec.n ?? spec.population.sizes.reduce((a, b) => a + b, 0);
  lines.push(`n ${n}`, `prevalence ${spec.prevalence}`, `ndays ${spec.ndays}`, `nsims ${spec.nsims}`, `seed ${spec.seed}`);
  for (const [k, v] of Object.entries(spec.params)) lines.push(`param ${k}=${v}`);
  if (spec.population) {
    lines.push(`groups ${spec.population.sizes.join(" ")}`);
    lines.push(`matrix ${spec.population.contact_matrix.flat().join(" ")}`);
  }
  lines.push(`outputs ${spec.outputs.join(" ")}`, "end");
}

writeFileSync(join(root, "test", "native", "specs.json"), JSON.stringify(cases, null, 1));
writeFileSync(join(root, "test", "native", "specs.txt"), lines.join("\n") + "\n");
console.log(`dump-specs: wrote ${cases.length} specs to test/native/`);
