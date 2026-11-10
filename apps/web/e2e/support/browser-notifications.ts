import type { BrowserContext, Page } from "@playwright/test";

type Recorded = { title: string; body: string; tag: string };
type NotifyWindow = Window & {
  __notifications: Recorded[];
  __clickNotification: (tag: string) => void;
};

// Troca a Notification do navegador por uma que guarda o que foi criado e deixa o teste clicar nela.
// A permissão é a pedida aqui; `requestPermission` responde `answer` e passa a valer.
export async function instrumentNotifications(
  context: BrowserContext,
  { permission, answer = permission }: { permission: NotificationPermission; answer?: NotificationPermission },
): Promise<void> {
  await context.addInitScript(
    ({ permission, answer }) => {
      const KEY = "__notificationPermission";
      const stored = sessionStorage.getItem(KEY) as NotificationPermission | null;
      let current: NotificationPermission = stored ?? permission;
      const created: { title: string; body: string; tag: string; instance: FakeNotification }[] = [];
      class FakeNotification {
        onclick: (() => void) | null = null;
        constructor(title: string, options: NotificationOptions = {}) {
          created.push({ title, body: options.body ?? "", tag: options.tag ?? "", instance: this });
        }
        close() {}
        static get permission() {
          return current;
        }
        static async requestPermission() {
          current = answer;
          sessionStorage.setItem(KEY, answer);
          return answer;
        }
      }
      Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
      Object.defineProperty(window, "__notifications", {
        get: () => created.map(({ title, body, tag }) => ({ title, body, tag })),
      });
      (window as unknown as NotifyWindow).__clickNotification = (tag) =>
        created.find((entry) => entry.tag === tag)?.instance.onclick?.();
    },
    { permission, answer },
  );
}

export function recordedNotifications(page: Page): Promise<Recorded[]> {
  return page.evaluate(() => (window as unknown as NotifyWindow).__notifications);
}

export function clickNotification(page: Page, tag: string): Promise<void> {
  return page.evaluate((value) => (window as unknown as NotifyWindow).__clickNotification(value), tag);
}
