import { defineConfig, devices } from "@playwright/test";
import Module from "node:module";
import path from "node:path";

const nodeTestShims = path.resolve(process.cwd(), "tests/node/shims");
process.env.NODE_PATH = [nodeTestShims, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
(Module as unknown as { _initPaths: () => void })._initPaths();

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      testMatch: "**/*.spec.ts",
      testIgnore: "**/node/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "node",
      testMatch: "**/node/**/*.node.spec.ts",
      use: {},
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
