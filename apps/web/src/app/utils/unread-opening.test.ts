import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import { firstUnreadId, needsOlderForUnread } from "./unread-opening";

const id = (n: number) => `01a1c5a4-0000-7000-8000-${String(n).padStart(12, "0")}`;

function message(n: number, authorId = "outra"): Message {
  return {
    id: id(n),
    conversationId: "c1",
    clientId: `client-${n}`,
    author: { kind: "person", id: authorId, name: "Pessoa", username: "pessoa", initials: "P" },
    body: `Mensagem ${n}`,
    createdAt: "2026-11-10T10:00:00.000Z",
    editedAt: null,
    mentions: [],
    quote: null,
  };
}

describe("firstUnreadId", () => {
  it("a primeira Não lida é a primeira de outro autor depois da Última leitura", () => {
    const list = [message(1), message(2, "eu"), message(3, "eu"), message(4), message(5)];

    expect(firstUnreadId(list, id(1), "eu")).toBe(id(4));
    expect(firstUnreadId(list, null, "eu")).toBe(id(1));
    // A primeira Não lida apagada saiu da lista: o divisor vai para a seguinte.
    expect(firstUnreadId([message(1), message(5)], id(1), "eu")).toBe(id(5));
  });

  it("sem Não lidas não há divisor", () => {
    expect(firstUnreadId([message(1), message(2, "eu")], id(1), "eu")).toBeNull();
    expect(firstUnreadId([message(1)], id(1), "eu")).toBeNull();
    expect(firstUnreadId([], null, "eu")).toBeNull();
  });
});

describe("needsOlderForUnread", () => {
  it("carrega as anteriores até a Última leitura", () => {
    expect(needsOlderForUnread([message(5), message(6)], id(3), true)).toBe(true);
    expect(needsOlderForUnread([message(5), message(6)], null, true)).toBe(true);
    expect(needsOlderForUnread([message(3), message(6)], id(3), true)).toBe(false);
    expect(needsOlderForUnread([message(2), message(6)], id(3), true)).toBe(false);
    expect(needsOlderForUnread([message(5), message(6)], id(3), false)).toBe(false);
  });
});
