import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import { jumpStep, openingTarget } from "./jump-to-message";

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

describe("openingTarget", () => {
  const id = "01a1c666-cfbd-7307-939b-94c399a576bf";

  it("a Mensagem pedida vence a primeira Não lida", () => {
    expect(openingTarget(id, { lastReadId: null })).toEqual({ kind: "message", id });
    expect(openingTarget(null, { lastReadId: "x" })).toEqual({ kind: "unread", lastReadId: "x" });
    expect(openingTarget(null, null)).toBeNull();
    // Um parâmetro que não é um id não leva a lugar nenhum.
    expect(openingTarget("abc", null)).toBeNull();
    // Em minúsculas, como os ids da API.
    expect(openingTarget(id.toUpperCase(), null)).toEqual({ kind: "message", id });
  });
});
