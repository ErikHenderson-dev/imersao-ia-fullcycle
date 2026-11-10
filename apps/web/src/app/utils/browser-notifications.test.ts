import { describe, expect, it } from "vitest";
import { browserNotificationsState, notificationPreview } from "./browser-notifications";

describe("browserNotificationsState", () => {
  it("o estado da opção do navegador", () => {
    expect(browserNotificationsState("unsupported", true)).toBe("unsupported");
    expect(browserNotificationsState("denied", true)).toBe("blocked");
    expect(browserNotificationsState("granted", true)).toBe("on");
    expect(browserNotificationsState("granted", false)).toBe("off");
    expect(browserNotificationsState("default", true)).toBe("off");
  });

  it("o começo do texto na notificação", () => {
    expect(notificationPreview("Oi,\n  tudo bem?")).toBe("Oi, tudo bem?");
    const long = "a".repeat(200);
    expect(notificationPreview(long)).toHaveLength(140);
    expect(notificationPreview(long).endsWith("…")).toBe(true);
  });
});
