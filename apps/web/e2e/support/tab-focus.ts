import type { BrowserContext, Page } from "@playwright/test";

type FocusWindow = Window & { __setTabFocus: (value: boolean) => void };

// No Chromium sem interface toda página diz que está visível e em foco. O script deixa o teste
// trocar isso: `setTabFocus(page, false)` esconde a aba e tira o foco, avisando a página como o
// navegador avisaria. O estado fica no sessionStorage da aba e vale depois de uma navegação.
export async function controlTabFocus(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const KEY = "__tabFocus";
    let isFocused = sessionStorage.getItem(KEY) !== "false";
    Object.defineProperty(document, "visibilityState", {
      get: () => (isFocused ? "visible" : "hidden"),
    });
    Object.defineProperty(document, "hasFocus", { value: () => isFocused });
    (window as unknown as FocusWindow).__setTabFocus = (value) => {
      isFocused = value;
      sessionStorage.setItem(KEY, String(value));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event(value ? "focus" : "blur"));
    };
  });
}

export function setTabFocus(page: Page, isFocused: boolean): Promise<void> {
  return page.evaluate(
    (value) => (window as unknown as FocusWindow).__setTabFocus(value),
    isFocused,
  );
}
