import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure library helpers (lib/**/*.test.ts). The @/ alias mirrors tsconfig so tests
// import modules the same way the app does. Resolve the root via import.meta so the config loads
// cleanly under Vite's native (ESM) config loader.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
