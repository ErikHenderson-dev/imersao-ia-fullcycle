import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import { jumpStep } from "./jump-to-message";

const message = (id: string) => ({ id }) as Message;

describe("jumpStep", () => {
  it("acha a original carregada", () => {
    expect(jumpStep([message("b"), message("c")], "b", true)).toBe("found");
  });

  it("continua enquanto a original é mais antiga que a lista e há páginas", () => {
    expect(jumpStep([message("c"), message("d")], "a", true)).toBe("continue");
  });

  it("para sem achar quando não há mais páginas", () => {
    expect(jumpStep([message("c")], "a", false)).toBe("missing");
  });

  it("para sem achar quando a lista já começa antes da original e ela não está lá", () => {
    expect(jumpStep([message("a"), message("c")], "b", true)).toBe("missing");
  });
});
