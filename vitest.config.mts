/// <reference types="vitest" />
import { defineConfig } from "vite";
import {
  vitestSetupFilePath,
  getClarinetVitestsArgv,
} from "@hirosystems/clarinet-sdk/vitest";

// Standard Clarinet SDK + vitest wiring (matches the setup `clarinet check`
// itself points to: "npm install && npm test", tests in ./tests).
// Loads Clarinet.toml from the project root and gives each test file a fresh
// simnet instance via the "clarinet" test environment.
//
// NOTE: this file must be .mts (not .js) — this project's package.json has no
// "type": "module", so a plain .js config gets loaded as CommonJS and the
// clarinet-sdk vitest helper's use of import.meta.resolve() fails at startup
// ("import.meta.resolve is not supported in CJS config files"). .mts forces
// Vite to treat it as real ESM regardless of package.json. Delete the old
// vitest.config.js — having both can confuse Vitest's config auto-detection.
export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
      },
    },
  },
});
