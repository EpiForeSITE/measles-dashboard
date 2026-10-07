import { expect, test } from "vitest";
import {
  activeCasesBand, defaultThresholds, describe as summarize, exceedanceProbabilities,
  finalOutbreakSizes, formatProbability, hospitalizationsPerSim, quantile,
} from "../../src/analysis.js";

test("quantile matches R type 7", () => {
  const x = Float64Array.from([1, 2, 3, 4]);
  expect(quantile(x, 0.5)).toBe(2.5);
  expect(quantile(x, 0.025)).toBeCloseTo(1.075, 12);
});

test("final outbreak size is the last day's value", () => {
  const table = { sim_id: [0, 0, 1, 1, 0], date: [0, 1, 0, 1, 2], outbreak_size: [1, 3, 1, 1, 5] };
  expect([...finalOutbreakSizes(table, 2)]).toEqual([5, 1]);
});

test("hospitalizations sum weights; sims without rows count as 0", () => {
  const table = { sim_id: [0, 0, 2], weight: [1, 0.5, 2] };
  expect([...hospitalizationsPerSim(table, 3)]).toEqual([1.5, 0, 2]);
  expect([...hospitalizationsPerSim(undefined, 2)]).toEqual([0, 0]);
});

test("exceedance probabilities and formatting follow the Shiny tabulator", () => {
  expect(exceedanceProbabilities([1, 2, 10, 30], [2, 10, 25, 50])).toEqual([0.75, 0.5, 0.25, 0]);
  expect(formatProbability(0.01)).toBe("< 1%");
  expect(formatProbability(0)).toBe("< 1%");
  expect(formatProbability(0.255)).toBe("26%");
});

test("active cases band fills missing days with 0", () => {
  const table = { sim_id: [0, 0, 1], date: [0, 1, 0], active_cases: [1, 4, 1] };
  const band = activeCasesBand(table, 2, 2);
  expect(band).toHaveLength(3);
  expect(band[1].median).toBe(2);
  expect(band[2]).toMatchObject({ median: 0, lower: 0, upper: 0 });
});

test("describe", () => {
  expect(summarize([1, 2, 3])).toMatchObject({ mean: 2, median: 2 });
});

test("default thresholds", () => {
  expect(defaultThresholds(500)).toEqual([2, 10, 25, 50, 80]);
  expect(defaultThresholds(9000)).toEqual([10, 50, 100, 500, 1000]);
  for (const n of [2000, 50000, 1e6]) {
    const t = defaultThresholds(n);
    expect(t.length).toBeLessThanOrEqual(5);
    expect(Math.max(...t)).toBeLessThanOrEqual(n * 0.2);
  }
});
