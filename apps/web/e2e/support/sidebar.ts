import type { Locator, Page } from "@playwright/test";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// O nome acessível de uma linha Não lida da barra lateral: o nome visível e o texto só para o
// leitor de tela (spec da F07). O navegador põe um espaço antes do texto escondido, que fica num
// elemento posicionado; o espaço é opcional aqui.
export function unreadRowName(name: string, suffix: string): RegExp {
  return new RegExp(`^${escapeRegExp(name)}\\s?${escapeRegExp(suffix)}$`);
}

// O link de uma Conversa na barra lateral.
export function sidebarLink(page: Page, name: string | RegExp): Locator {
  return page.getByRole("navigation", { name: "Conversas" }).getByRole("link", { name });
}
