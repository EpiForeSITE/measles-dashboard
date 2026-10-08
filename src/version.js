/**
 * The dashboard's version (from package.json, injected at build time by
 * vite.config.js) and where its releases live.
 */

/* global __APP_VERSION__ */
export const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const REPOSITORY_URL = "https://github.com/EpiForeSITE/measles-dashboard";

/** The latest release; also where the version badge links. */
export const RELEASES_URL = `${REPOSITORY_URL}/releases/latest`;
