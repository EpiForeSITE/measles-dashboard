import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseSchoolCSV, uploadedSchools, validatePopulation } from "../../src/data.js";
import { parseCSV } from "../../src/csv.js";

const dir = new URL("../../public/data/", import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, dir), "utf8"));

test("bundled school data: every row, rates in [0, 1], unique ids", () => {
  const index = json("schools/index.json");
  let total = 0;
  const ids = new Set();
  for (const { code, n } of index.states) {
    const { counties, schools } = json(`schools/${code}.json`);
    expect(schools).toHaveLength(n);
    for (const [county, name, id, rate] of schools) {
      expect(counties[county]).toBeTypeOf("string");
      expect(name.length).toBeGreaterThan(0);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
      ids.add(id);
    }
    total += n;
  }
  expect(index.states).toHaveLength(25);
  expect(total).toBe(49324);
  expect(ids.size).toBe(total);
});

test("population presets are valid", () => {
  for (const { file } of json("populations/index.json").presets)
    expect(validatePopulation(json(`populations/${file}`))).toEqual([]);
});

test("validatePopulation catches bad groups and matrices", () => {
  const ok = { groups: [{ name: "a", size: 10 }], contact_matrix: [[1]] };
  expect(validatePopulation(ok)).toEqual([]);
  expect(validatePopulation({ ...ok, groups: [{ name: "a", size: 0 }] })).toHaveLength(1);
  expect(validatePopulation({ ...ok, contact_matrix: [[1, 2]] })).toHaveLength(1);
  expect(validatePopulation({ ...ok, contact_matrix: [[-1]] })).toHaveLength(1);
  expect(validatePopulation({ ...ok, contact_matrix: [[0]] })).toHaveLength(1);
});

test("CSV parsing handles quotes and CRLF", () => {
  expect(parseCSV('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
});

const header = "state,county,school_name,school_id,vaccination_rate,num_students\n";

test("school upload: valid file, NA enrollment, cascade", async () => {
  const rows = parseSchoolCSV(header + 'UT,Salt Lake,"School, A",UT-1,0.9,NA\nUT,Salt Lake,B,UT-2,0.5,300\nID,Ada,C,ID-1,1,\n');
  expect(rows[0]).toMatchObject({ name: "School, A", rate: 0.9, size: null });
  expect(rows[1].size).toBe(300);
  const source = uploadedSchools(rows);
  expect(await source.states()).toEqual(["ID", "UT"]);
  // Sorted by name: "B" before "School, A"
  expect((await source.schools("UT", "Salt Lake")).map((s) => s.id)).toEqual(["UT-2", "UT-1"]);
});

test("school upload: rejects what the Shiny app rejects", () => {
  expect(() => parseSchoolCSV("state,county\nUT,x\n")).toThrow(/must contain columns/);
  expect(() => parseSchoolCSV(header + "UT,a,b,c,1.2,\n")).toThrow(/vaccination_rate/);
  expect(() => parseSchoolCSV(header + "UT,a,b,c,0.5,60000\n")).toThrow(/num_students/);
  expect(() => parseSchoolCSV(header + "UT,a,b,c,0.5,\n".repeat(10001))).toThrow(/too many/);
});

test("searchSchools matches every word in name or county, accent-insensitive", async () => {
  const { searchSchools } = await import("../../src/data.js");
  const schools = [
    { name: "Adele C. Young Intermediate", county: "Box Elder" },
    { name: "Young Elementary", county: "Salt Lake" },
    { name: "Escuela José Martí", county: "Box Elder" },
  ];
  expect(searchSchools(schools, "young").map((s) => s.name)).toEqual(["Young Elementary", "Adele C. Young Intermediate"]);
  expect(searchSchools(schools, "adele young")).toHaveLength(1);
  expect(searchSchools(schools, "jose box")).toHaveLength(1);
  expect(searchSchools(schools, "")).toHaveLength(3);
});
