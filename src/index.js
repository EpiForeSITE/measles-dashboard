/**
 * measles-dashboard: registers <measles-dashboard>, <measles-school-sim> and
 * <measles-mixing-sim>, and exports the building blocks for custom pages.
 */

export { configure } from "./config.js";
export { loadEngine, runAll } from "./engine.js";
export * from "./analysis.js";
export * from "./r0.js";
export { schoolSpec, mixingSpec, mixingMatrix } from "./specs.js";
export { SCHOOL_INPUTS, MIXING_INPUTS } from "./params.js";
export { MeaslesDashboard } from "./components/measles-dashboard.js";
export { SchoolSim } from "./components/school-sim.js";
export { MixingSim } from "./components/mixing-sim.js";
