import { describe, expect, it } from "vitest";
import type { Conversation } from "@/app/services/chat-api";
import { formatCount, hasVisibleUnread, unreadDisplay, unreadTitle } from "./unread";

function channel(unreadCount: number, mentionCount: number): Conversation {
  return {
    id: "c1",
    kind: "public_channel",
    name: "geral",
    topic: null,
    memberCount: 3,
    counterpart: null,
    lastReadMessageId: null,
    unreadCount,
    mentionCount,
  };
}

function direct(unreadCount: number): Conversation {
  return {
    ...channel(unreadCount, 0),
    kind: "direct",
    name: "",
    counterpart: { id: "p1", name: "Alfredo Luiz", username: "alfredo", initials: "AL" },
  };
}

describe("formatCount", () => {
  it("mostra o número até 99 e 99+ acima", () => {
    expect(formatCount(1)).toBe("1");
    expect(formatCount(99)).toBe("99");
    expect(formatCount(100)).toBe("99+");
  });
});

describe("unreadDisplay", () => {
  it("no Canal, o negrito vem das Não lidas e o contador das Menções", () => {
    expect(unreadDisplay(channel(5, 2))).toMatchObject({ isUnread: true, count: 2 });
    expect(unreadDisplay(channel(5, 0))).toMatchObject({ isUnread: true, count: 0 });
    expect(unreadDisplay(channel(0, 0))).toMatchObject({ isUnread: false, count: 0 });
  });

  it("na Conversa direta, o contador é o número de Não lidas", () => {
    expect(unreadDisplay(direct(3))).toMatchObject({ isUnread: true, count: 3 });
  });

  it("monta o texto da linha para o leitor de tela", () => {
    expect(unreadDisplay(channel(5, 2)).suffix).toBe(", não lidas, 2 menções");
    expect(unreadDisplay(channel(5, 1)).suffix).toBe(", não lidas, 1 menção");
    expect(unreadDisplay(channel(5, 100)).suffix).toBe(", não lidas, mais de 99 menções");
    expect(unreadDisplay(channel(1, 0)).suffix).toBe(", não lidas");
    expect(unreadDisplay(channel(0, 0)).suffix).toBe("");
    expect(unreadDisplay(direct(3)).suffix).toBe(", 3 mensagens não lidas");
    expect(unreadDisplay(direct(1)).suffix).toBe(", 1 mensagem não lida");
    expect(unreadDisplay(direct(100)).suffix).toBe(", mais de 99 mensagens não lidas");
    expect(unreadDisplay(direct(0)).suffix).toBe("");
  });

  it("a Conversa aberta em foco não mostra negrito nem contador", () => {
    expect(unreadDisplay(channel(5, 2), true)).toEqual({ isUnread: false, count: 0, suffix: "" });
    expect(unreadDisplay(direct(3), true)).toEqual({ isUnread: false, count: 0, suffix: "" });
    expect(unreadDisplay(direct(3), false)).toMatchObject({ isUnread: true, count: 3 });
  });
});

describe("título e marcador", () => {
  const noneOpen = () => false;

  it("o título soma os contadores visíveis", () => {
    const list = [channel(5, 2), { ...direct(3), id: "d1" }, { ...channel(4, 0), id: "c2" }];

    expect(unreadTitle(list, noneOpen)).toBe("(5) Full Cycle Chat");
    expect(unreadTitle(list, (conversation) => conversation.id === "d1")).toBe("(2) Full Cycle Chat");
    expect(unreadTitle([channel(0, 0)], noneOpen)).toBe("Full Cycle Chat");
    expect(unreadTitle([channel(100, 100), { ...direct(5), id: "d1" }], noneOpen)).toBe(
      "(99+) Full Cycle Chat",
    );
  });

  it("o marcador acende com qualquer Conversa Não lida", () => {
    expect(hasVisibleUnread([channel(4, 0)], noneOpen)).toBe(true);
    expect(hasVisibleUnread([channel(4, 0)], () => true)).toBe(false);
    expect(hasVisibleUnread([channel(0, 0)], noneOpen)).toBe(false);
  });
});
