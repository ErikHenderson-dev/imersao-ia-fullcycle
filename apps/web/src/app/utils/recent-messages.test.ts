import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import { newerThan, rememberMessage } from "./recent-messages";

function message(id: string): Message {
  return {
    id,
    conversationId: "c1",
    clientId: `client-${id}`,
    author: { kind: "person", id: "p1", name: "Ana Souza", username: "pessoa", initials: "AS" },
    body: `Mensagem ${id}`,
    createdAt: "2026-11-09T12:00:00.000Z",
    editedAt: null,
    mentions: [],
    quote: null,
    quickReplies: null,
    businessData: false,
    blocked: false,
  };
}

describe("rememberMessage", () => {
  it("guarda em ordem de id, mesmo quando chega fora de ordem", () => {
    const recent = [message("1"), message("3")];

    expect(rememberMessage(recent, message("2")).map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("ignora um id que já está guardado", () => {
    const recent = [message("1"), message("2")];

    expect(rememberMessage(recent, message("2")).map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("guarda as últimas 100 por Conversa", () => {
    const recent = Array.from({ length: 100 }, (_, index) =>
      message(String(index).padStart(3, "0")),
    );

    const result = rememberMessage(recent, message("100"));

    expect(result).toHaveLength(100);
    expect(result[0].id).toBe("001");
    expect(result.at(-1)?.id).toBe("100");
  });
});

describe("newerThan", () => {
  it("devolve só as mais novas que o id dado", () => {
    const recent = [message("1"), message("2"), message("3")];

    expect(newerThan(recent, "2").map((item) => item.id)).toEqual(["3"]);
  });

  it("devolve todas sem um id", () => {
    expect(newerThan([message("1")], undefined)).toHaveLength(1);
  });
});
