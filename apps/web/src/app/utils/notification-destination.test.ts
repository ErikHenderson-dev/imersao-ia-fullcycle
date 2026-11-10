import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notification-destination";

describe("notificationDestination", () => {
  it("para onde vai a Notificação", () => {
    const base = { kind: "mention" as const, isTabFocused: true, isConversationOpen: false };
    expect(notificationDestination(base)).toBe("alert");
    expect(notificationDestination({ ...base, kind: "direct" })).toBe("alert");
    expect(notificationDestination({ ...base, isConversationOpen: true })).toBe("none");
    expect(notificationDestination({ ...base, isTabFocused: false })).toBe("none");
    expect(notificationDestination({ ...base, kind: null })).toBe("none");
  });
});
