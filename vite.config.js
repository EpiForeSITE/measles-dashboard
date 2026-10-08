import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Library build: dist/measles-dashboard.js (Lit and Observable Plot bundled
// in). epiworldjs is not bundled: it locates its .wasm and worker files
// relative to its own modules, so scripts/postbuild.mjs copies it to
// dist/epiworldjs/ and the dashboard imports it at runtime (see src/config.js).
export default defineConfig({
  // The version shown in the dashboard (src/version.js)
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "measles-dashboard.js",
    },
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["test/unit/**/*.test.js"],
    testTimeout: 120000,
  },
});
