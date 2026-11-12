import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// O axe nos temas claro e escuro. A troca de tema anima as cores (transition-colors): o axe mede o
// contraste depois que só as transições de cor terminam, e não as animações infinitas, como o
// spinner (armadilha da F10).
export async function expectNoViolationsInBothThemes(page: Page): Promise<void> {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"),
    );
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }
}
