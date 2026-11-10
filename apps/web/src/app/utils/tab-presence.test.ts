import { describe, expect, it } from "vitest";
import { applyTabFocus } from "./tab-presence";

describe("applyTabFocus", () => {
  it("o conjunto das abas em foco", () => {
    let focused = applyTabFocus(new Set(), { type: "focus", tabId: "a", isFocused: true });
    expect([...focused]).toEqual(["a"]);
    focused = applyTabFocus(focused, { type: "focus", tabId: "b", isFocused: true });
    expect(focused.size).toBe(2);
    focused = applyTabFocus(focused, { type: "focus", tabId: "a", isFocused: false });
    expect([...focused]).toEqual(["b"]);
    focused = applyTabFocus(focused, { type: "hello", tabId: "c" });
    expect([...focused]).toEqual(["b"]);
    focused = applyTabFocus(focused, { type: "bye", tabId: "b" });
    expect(focused.size).toBe(0);
  });
});
