import { describe, expect, test } from "vitest";
import {
  calibrateMatrix, effectiveR, herdImmunityThreshold, mixingInfectiousPeriod, mixingR0,
  schoolContactRate, schoolR0, spectralRadius,
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
  test("reproduces the Shiny default contact rate 15/.99/4", () => {
    expect(schoolContactRate(15, 0.99, 4)).toBeCloseTo(15 / 0.99 / 4, 12);
    expect(schoolR0(schoolContactRate(12, 0.9, 5), 0.9, 5)).toBeCloseTo(12, 12);
  });
});

describe("mixing calibration", () => {
  const m = [[13.5, 0.75, 0.75], [1.5, 12, 1.5], [1.5, 3, 10.5]];
  test("infectious period accounts for rash contacts and hospitalization", () => {
    expect(mixingInfectiousPeriod(4, 3, 1, 0.2)).toBe(4);
    expect(mixingInfectiousPeriod(4, 3, 0, 0)).toBeCloseTo(7, 12);
    expect(mixingInfectiousPeriod(4, 3, 0.5, 0.2)).toBeCloseTo(4 + 0.5 / (1 / 3 + 0.2), 12);
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
