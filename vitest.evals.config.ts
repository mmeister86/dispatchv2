import { defineConfig } from "vitest/config";

// Slow eval suites, run separately via `pnpm test:evals` (and CI).
export default defineConfig({
  test: {
    include: ["tests/evals/**/*.test.ts"],
  },
});
