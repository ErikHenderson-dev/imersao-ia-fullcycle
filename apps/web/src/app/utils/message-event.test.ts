import { describe, expect, it } from "vitest";
import { messageFromEvent } from "./message-event";

describe("messageFromEvent", () => {
  it("monta a Mensagem da web com as iniciais do autor", () => {
    const message = messageFromEvent({
      id: "m1",
      conversation_id: "c1",
      client_id: "k1",
      author: { id: "p1", name: "Bruno Lima" },
      body: "Olá",
      created_at: "2026-11-09T12:00:00.000Z",
      edited_at: null,
      mentions: [],
      quote: null,
    });

    expect(message).toEqual({
      id: "m1",
      conversationId: "c1",
      clientId: "k1",
      author: { id: "p1", name: "Bruno Lima", initials: "BL" },
      body: "Olá",
      createdAt: "2026-11-09T12:00:00.000Z",
      editedAt: null,
      mentions: [],
      quote: null,
    });
  });

  it("normaliza o evento gravado antes da edição e das Menções", () => {
    const legacy = {
      id: "m1",
      conversation_id: "c1",
      client_id: "k1",
      author: { id: "p1", name: "Bruno Lima" },
      body: "Olá",
      created_at: "2026-11-09T12:00:00.000Z",
    } as unknown as Parameters<typeof messageFromEvent>[0];

    expect(messageFromEvent(legacy)).toMatchObject({ editedAt: null, mentions: [], quote: null });
  });
});
