import { defineConfig } from "@playwright/test";
import Module from "node:module";
import path from "node:path";

const nodeTestShims = path.resolve(process.cwd(), "tests/node/shims");
process.env.NODE_PATH = [nodeTestShims, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
(Module as unknown as { _initPaths: () => void })._initPaths();

export default defineConfig({
  testDir: "./tests/node",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  projects: [{ name: "node" }],
});
