import { describe, expect, it } from "vitest";
import { isNewerMark } from "./activity-unread";

const counts = (mark: string | null) => ({
  activityReadMessageId: mark,
  totalCount: 0,
  mentionCount: 0,
  directCount: 0,
  taskCount: 0,
});

describe("isNewerMark", () => {
  it("só a marca mais nova que a do cache vale", () => {
    expect(isNewerMark(counts("0002"), counts("0001"))).toBe(true);
    expect(isNewerMark(counts("0002"), counts(null))).toBe(true);
    expect(isNewerMark(counts("0002"), undefined)).toBe(true);
    expect(isNewerMark(counts("0002"), counts("0002"))).toBe(false);
    expect(isNewerMark(counts("0001"), counts("0002"))).toBe(false);
    expect(isNewerMark(counts(null), counts(null))).toBe(false);
  });
});
