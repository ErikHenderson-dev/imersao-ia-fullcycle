import { describe, expect, it } from "vitest";
import type { Conversation } from "@/app/services/chat-api";
import { formatCount, unreadDisplay } from "./unread";

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
});
