import type { Locator, Page } from "@playwright/test";

// A seção Agentes da barra lateral e o diálogo "Agentes" (spec da F10, "Cliente").
export function agentsSection(page: Page): Locator {
  return page.getByRole("navigation", { name: "Conversas" }).getByRole("region", { name: "Agentes" });
}

export function agentsDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Agentes" });
}
