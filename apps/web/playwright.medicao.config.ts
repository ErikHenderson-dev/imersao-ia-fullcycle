import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// As medições (e2e/medicao/*.medicao.ts) rodam fora da suíte, uma de cada vez e só a pedido, no
// contêiner e2e: npx playwright test --config playwright.medicao.config.ts. O testMatch da suíte não
// pega .medicao.ts.
export default defineConfig({
  ...base,
  testDir: "./e2e/medicao",
  testMatch: "**/*.medicao.ts",
  workers: 1,
  reporter: [["list"]],
  projects: [{ name: "medicao" }],
});
