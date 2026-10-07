/**
 * Where the dashboard finds epiworldjs and its data files.
 *
 * In the built bundle both live next to measles-dashboard.js
 * (`./epiworldjs/` and `./data/`), so copying the dist folder anywhere is
 * enough. Hosts can point elsewhere (e.g., a CDN) with `configure()` or the
 * elements' `base-url` / `engine-url` attributes.
 */

const dev = import.meta.env?.DEV ?? false;

// Through a variable: Vite rewrites `new URL("<literal>", import.meta.url)`
// into a bundled asset, but this must stay the bundle's own location
const here = import.meta.url;

const settings = {
  baseUrl: dev ? new URL("/", globalThis.location?.href ?? "http://localhost/").href : new URL("./", here).href,
  engineUrl: undefined,
};

/**
 * @param {{baseUrl?: string, engineUrl?: string}} options
 *   baseUrl: folder holding `data/` and `assets/`.
 *   engineUrl: URL of epiworldjs's `src/index.js` (e.g.,
 *   "https://cdn.jsdelivr.net/npm/epiworldjs@0.18.0-0/src/index.js").
 */
export function configure({ baseUrl, engineUrl } = {}) {
  if (baseUrl) settings.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : baseUrl + "/", globalThis.location?.href).href;
  if (engineUrl) settings.engineUrl = new URL(engineUrl, globalThis.location?.href).href;
}

/** Resolves a path such as "data/schools/index.json" against the base URL. */
export function resolveAsset(path) {
  return new URL(path, settings.baseUrl).href;
}

export function engineUrl() {
  if (settings.engineUrl) return settings.engineUrl;
  return dev
    ? new URL("/node_modules/epiworldjs/src/index.js", globalThis.location.href).href
    : resolveAsset("epiworldjs/src/index.js");
}
