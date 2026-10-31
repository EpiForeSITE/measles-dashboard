import { describe, expect, test } from "vitest";
import {
  calibrateMatrix, effectiveR, expectedStageDays, herdImmunityThreshold, mixingInfectiousPeriod, mixingR0,
  schoolContactRate, schoolInfectiousPeriod, schoolR0, spectralRadius,
} from "../../src/r0.js";

describe("spectralRadius", () => {
  test("diagonal and constant matrices", () => {
    expect(spectralRadius([[3, 0], [0, 7]])).toBeCloseTo(7, 10);
    expect(spectralRadius([[1, 1, 1], [1, 1, 1], [1, 1, 1]])).toBeCloseTo(3, 10);
    expect(spectralRadius([[5]])).toBeCloseTo(5, 12);
    expect(spectralRadius([[0, 0], [0, 0]])).toBe(0);
  });
  test("periodic (bipartite) matrix converges", () => {
    expect(spectralRadius([[0, 4], [1, 0]])).toBeCloseTo(2, 8);
  });
  test("non-symmetric 2x2 against the closed form", () => {
    const [a, b, c, d] = [13.5, 0.75, 1.5, 12];
    const rho = (a + d) / 2 + Math.sqrt(((a - d) / 2) ** 2 + b * c);
    expect(spectralRadius([[a, b], [c, d]])).toBeCloseTo(rho, 10);
  });
});

describe("school calibration", () => {
  test("a fixed prodromal period reproduces the Shiny default contact rate 15/.99/4", () => {
    const v = { r0: 15, transmissionRate: 0.99, prodromalPeriod: 4, prodromalSd: 0 };
    expect(schoolContactRate(v)).toBeCloseTo(15 / 0.99 / 4, 12);
    expect(schoolR0(schoolContactRate(v), 0.99, schoolInfectiousPeriod(v))).toBeCloseTo(15, 12);
  });
  test("uses the expected days of the drawn (rounded, at least 1) prodromal period", () => {
    // A mean of 1 with sd 1.7: rounding and the 1-day minimum give 1.4288 days
    const v = { r0: 15, transmissionRate: 0.9, prodromalPeriod: 1, prodromalSd: 1.7 };
    expect(schoolInfectiousPeriod(v)).toBeCloseTo(1.428802, 5);
    expect(schoolContactRate(v)).toBeCloseTo(15 / (0.9 * 1.428802), 4);
  });
});

describe("mixing calibration", () => {
  const m = [[13.5, 0.75, 0.75], [1.5, 12, 1.5], [1.5, 3, 10.5]];
  const fixed = { prodromalPeriod: 4, prodromalSd: 0, rashPeriod: 3, rashSd: 0 };
  test("infectious period accounts for rash contacts and hospitalization", () => {
    expect(mixingInfectiousPeriod({ ...fixed, rashContactReduction: 1, hospitalizationRate: 0.2 })).toBe(4);
    expect(mixingInfectiousPeriod({ ...fixed, rashContactReduction: 0, hospitalizationRate: 0 })).toBeCloseTo(7, 12);
    // In rash on days 1, 2, 3 with probabilities 1, 0.8, 0.64
    expect(mixingInfectiousPeriod({ ...fixed, rashContactReduction: 0.5, hospitalizationRate: 0.2 })).toBeCloseTo(4 + 0.5 * 2.44, 12);
  });
  test("expected stage days match reference sums (to 2e7 days, in R), including the tails", () => {
    expect(expectedStageDays(4, 1.7)).toBeCloseTo(4.000156, 5);
    expect(expectedStageDays(1, 1.7)).toBeCloseTo(1.428802, 5);
    // The largest sd the inputs allow: a 200-day cutoff gave 3.74
    expect(expectedStageDays(4, 30)).toBeCloseTo(4.436725, 4);
    expect(expectedStageDays(3, 1, 0.2)).toBeCloseTo(2.375218, 5);
    expect(expectedStageDays(3, 30, 0.035)).toBeCloseTo(2.229297, 5);
    expect(expectedStageDays(3, 0)).toBe(3);
  });
  test("mixing infectious period at the largest prodromal sd", () => {
    const v = { prodromalPeriod: 4, prodromalSd: 30, rashPeriod: 3, rashSd: 1, rashContactReduction: 1, hospitalizationRate: 0.035 };
    expect(mixingInfectiousPeriod(v)).toBeCloseTo(4.436725, 4);
  });
  test("scaled matrix implies the target R0 and keeps its shape", () => {
    const { matrix, factor } = calibrateMatrix(m, 15, 0.99, 4);
    expect(mixingR0(matrix, 0.99, 4)).toBeCloseTo(15, 8);
    matrix.forEach((row, i) => row.forEach((x, j) => expect(x).toBeCloseTo(m[i][j] * factor, 12)));
  });
  test("an empty matrix cannot be calibrated", () => {
    expect(() => calibrateMatrix([[0]], 15, 0.9, 4)).toThrow();
  });
});

test("effective R and herd immunity", () => {
  expect(effectiveR(15, 0.85, 0.97)).toBeCloseTo(15 * (1 - 0.85 * 0.97), 12);
  expect(herdImmunityThreshold(15)).toBeCloseTo(14 / 15, 12);
  expect(herdImmunityThreshold(0.8)).toBe(0);
});
