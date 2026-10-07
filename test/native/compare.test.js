// Native C++ vs WebAssembly: the dashboard's specs (scripts/dump-specs.mjs)
// must give identical output tables when run by the native reference
// (compare.cpp, built by `npm run test:native`) and by epiworldjs.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Core } from "epiworldjs";
import { beforeAll, describe, expect, test } from "vitest";

const here = (p) => new URL(p, import.meta.url).pathname;
const binary = here("../../build/compare");
const cases = JSON.parse(readFileSync(here("specs.json"), "utf8"));

/** Parses compare.cpp's output: spec name → output name → {colnames, rows}. */
function parseNative(text) {
  const out = {};
  let spec, table;
  for (const line of text.split("\n")) {
    if (!line) continue;
    if (line.startsWith("## ")) {
      table = { colnames: null, rows: [] };
      out[spec][line.slice(3)] = table;
    } else if (line.startsWith("# ")) {
      spec = line.slice(2);
      out[spec] = {};
    } else if (!table.colnames) table.colnames = line.split("\t");
    else table.rows.push(line.split("\t"));
  }
  return out;
}

let native, core;
beforeAll(async () => {
  if (!existsSync(binary)) throw new Error("build/compare is missing; run `npm run test:native`.");
  native = parseNative(execFileSync(binary, [here("specs.txt")], { encoding: "utf8", maxBuffer: 1 << 30 }));
  core = await Core.load();
});

test("the epiworldjs headers match the WebAssembly build", () => {
  const dir = process.env.EPIWORLDJS_DIR ?? here("../../../epiworldjs");
  const local = JSON.parse(readFileSync(`${dir}/package.json`, "utf8")).version;
  const npm = JSON.parse(readFileSync(here("../../node_modules/epiworldjs/package.json"), "utf8")).version;
  expect(local, `headers from epiworldjs ${local}, WASM from ${npm}`).toBe(npm);
});

describe.each(cases.map((c) => [c.name, c.spec]))("%s", (name, spec) => {
  test("native and WebAssembly tables are identical", () => {
    const wasm = core.run(spec);
    for (const output of spec.outputs) {
      const n = native[name][output];
      const w = wasm[output];
      expect(Object.keys(w), `${output} columns`).toEqual(n.colnames);
      const columns = Object.values(w);
      const nrow = columns[0].length;
      expect(nrow, `${output} rows`).toBe(n.rows.length);
      for (let i = 0; i < nrow; i++) {
        for (let j = 0; j < columns.length; j++) {
          const a = n.rows[i][j];
          const b = columns[j][i];
          const same = typeof b === "string" ? a === b : Number(a) === b;
          if (!same)
            throw new Error(`${name}/${output}: first difference at row ${i} (sim ${n.rows[i][0]}), column ${n.colnames[j]}: native ${a}, wasm ${b}`);
        }
      }
    }
  });

  test("the run is not trivial", () => {
    const sizes = native[name].outbreak_size.rows.map((r) => Number(r.at(-1)));
    expect(Math.max(...sizes)).toBeGreaterThan(1);
  });
});
