import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    benchmark: {
      include: ["benchmarks/**/*.bench.ts"],
      includeSamples: false,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The CLI is exercised via a subprocess in tests/cli.test.ts, so v8
      // coverage cannot attribute it; measure the importable library only.
      exclude: ["src/cli.ts"],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
