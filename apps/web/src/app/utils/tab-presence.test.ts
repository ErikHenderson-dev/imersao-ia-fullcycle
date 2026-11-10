import { describe, expect, it } from "vitest";
import { anyFocusedAnswer } from "./tab-presence";

describe("anyFocusedAnswer", () => {
  it("só as respostas desta pergunta contam", () => {
    expect(anyFocusedAnswer([], "a")).toBe(false);
    expect(anyFocusedAnswer([{ type: "answer", askId: "a", isFocused: false }], "a")).toBe(false);
    expect(anyFocusedAnswer([{ type: "answer", askId: "a", isFocused: true }], "a")).toBe(true);
    expect(anyFocusedAnswer([{ type: "answer", askId: "b", isFocused: true }], "a")).toBe(false);
    expect(anyFocusedAnswer([{ type: "ask", askId: "a" }], "a")).toBe(false);
  });
});
