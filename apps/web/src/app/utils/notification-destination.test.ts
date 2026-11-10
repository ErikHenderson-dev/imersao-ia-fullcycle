import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notification-destination";

describe("notificationDestination", () => {
  it("para onde vai a Notificação", () => {
    const base = {
      kind: "mention" as const,
      isTabFocused: true,
      isConversationOpen: false,
      isAnyTabFocused: true,
      isBrowserEnabled: false,
    };
    expect(notificationDestination(base)).toBe("alert");
    expect(notificationDestination({ ...base, kind: "direct" })).toBe("alert");
    expect(notificationDestination({ ...base, isConversationOpen: true })).toBe("none");
    expect(notificationDestination({ ...base, isTabFocused: false, isAnyTabFocused: false })).toBe("none");
    expect(notificationDestination({ ...base, kind: null })).toBe("none");
  });

  it("o navegador só sem nenhuma aba em foco", () => {
    const base = {
      kind: "mention" as const,
      isTabFocused: false,
      isConversationOpen: false,
      isAnyTabFocused: false,
      isBrowserEnabled: true,
    };
    expect(notificationDestination(base)).toBe("browser");
    expect(notificationDestination({ ...base, isConversationOpen: true })).toBe("browser");
    expect(notificationDestination({ ...base, isBrowserEnabled: false })).toBe("none");
    expect(notificationDestination({ ...base, isAnyTabFocused: true })).toBe("none");
    expect(notificationDestination({ ...base, isTabFocused: true, isAnyTabFocused: true })).toBe("alert");
  });
});
