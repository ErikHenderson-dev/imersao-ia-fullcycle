import type { Locator, Page } from "@playwright/test";

// O painel de perfil (spec da F05, "Painel de perfil").
export function profilePanel(page: Page): Locator {
  return page.getByRole("complementary", { name: "Perfil" });
}

// O nome do autor no histórico, que abre o Perfil dele.
export function authorButton(page: Page, name: string): Locator {
  return page.getByRole("main").getByRole("button", { name, exact: true }).first();
}
