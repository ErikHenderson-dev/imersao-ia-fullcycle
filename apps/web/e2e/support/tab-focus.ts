import type { BrowserContext, Page } from "@playwright/test";

// No Chromium sem interface toda página diz que está visível e em foco. O script deixa o teste
// trocar isso: `setTabFocus(page, false)` esconde a aba e tira o foco, avisando a página como o
// navegador avisaria.
export async function controlTabFocus(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    let isFocused = true;
    Object.defineProperty(document, "visibilityState", {
      get: () => (isFocused ? "visible" : "hidden"),
    });
    Object.defineProperty(document, "hasFocus", { value: () => isFocused });
    (window as unknown as { __setTabFocus: (value: boolean) => void }).__setTabFocus = (value) => {
      isFocused = value;
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event(value ? "focus" : "blur"));
    };
  });
}

export function setTabFocus(page: Page, isFocused: boolean): Promise<void> {
  return page.evaluate(
    (value) => (window as unknown as { __setTabFocus: (value: boolean) => void }).__setTabFocus(value),
    isFocused,
  );
}
