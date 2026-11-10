import { describe, expect, it } from "vitest";
import { browserNotificationsState } from "./browser-notifications";

describe("browserNotificationsState", () => {
  it("o estado da opção do navegador", () => {
    expect(browserNotificationsState("unsupported", true)).toBe("unsupported");
    expect(browserNotificationsState("denied", true)).toBe("blocked");
    expect(browserNotificationsState("granted", true)).toBe("on");
    expect(browserNotificationsState("granted", false)).toBe("off");
    expect(browserNotificationsState("default", true)).toBe("off");
  });
});
