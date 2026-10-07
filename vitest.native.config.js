import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/native/**/*.test.js"],
    testTimeout: 300000,
    hookTimeout: 300000,
  },
});
