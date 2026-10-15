import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Default `pnpm test` run: unit + integration suites. The slow eval suites
// under tests/evals/** are excluded here; run them via `pnpm test:evals`.
// NOTE: the `@` alias must mirror vite.config.ts — without a vitest config
// file vitest fell back to vite.config.ts for it; this file replaces that.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "tests/evals/**",
    ],
  },
});
