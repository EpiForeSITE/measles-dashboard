/**
 * The epiworldjs engine, shared by every element on the page: one
 * WebAssembly module and one worker pool, loaded on first use.
 */

import { engineUrl } from "./config.js";

let enginePromise;

/** @returns {Promise<import("epiworldjs").Epiworld>} */
export function loadEngine() {
  enginePromise ??= import(/* @vite-ignore */ engineUrl())
    .then(({ Epiworld }) => Epiworld.load())
    .catch((error) => {
      enginePromise = undefined;
      throw new Error(`Could not load the simulation engine (${engineUrl()}): ${error.message}`);
    });
  return enginePromise;
}

/**
 * Runs several specs concurrently on the shared pool.
 *
 * @param {object[]} specs
 * @returns {Promise<import("epiworldjs").Result[]>}
 */
export async function runAll(specs) {
  const ew = await loadEngine();
  return Promise.all(specs.map((spec) => ew.run(spec)));
}

/** @returns {Promise<{epiworld: string, measles: string}>} */
export async function engineVersion() {
  return (await loadEngine()).version();
}
