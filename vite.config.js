import { defineConfig } from "vite";

// Library build: dist/measles-dashboard.js (Lit and Observable Plot bundled
// in). epiworldjs is not bundled: it locates its .wasm and worker files
// relative to its own modules, so scripts/postbuild.mjs copies it to
// dist/epiworldjs/ and the dashboard imports it at runtime (see src/config.js).
export default defineConfig({
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
