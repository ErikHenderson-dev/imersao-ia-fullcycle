import { describe, expect, it } from "vitest";
import { messageFromEvent } from "./message-event";

describe("messageFromEvent", () => {
  it("monta a Mensagem da web com as iniciais do autor", () => {
    const message = messageFromEvent({
      id: "m1",
      conversation_id: "c1",
      client_id: "k1",
      author: { kind: "bot", id: "p1", name: "Bruno Lima", username: "bruno" },
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
      author: { kind: "bot", id: "p1", name: "Bruno Lima", username: "bruno", initials: "BL" },
      body: "Olá",
      createdAt: "2026-11-09T12:00:00.000Z",
      editedAt: null,
      mentions: [],
      quote: null,
      quickReplies: null,
    });
  });

  it("converte as Respostas prontas da pergunta do Agente", () => {
    const message = messageFromEvent({
      id: "m1",
      conversation_id: "c1",
      client_id: "k1",
      author: { kind: "bot", id: "b1", name: "Assistente", username: "assistente" },
      body: "De que período você quer o resumo?",
      created_at: "2026-11-09T12:00:00.000Z",
      edited_at: null,
      mentions: [],
      quote: null,
      quick_replies: { options: ["Hoje (3)"], owner_id: "p1", expires_at: "2026-11-09T13:00:00.000Z", closed: false },
    });

    expect(message.quickReplies).toEqual({
      options: ["Hoje (3)"],
      ownerId: "p1",
      expiresAt: "2026-11-09T13:00:00.000Z",
      closed: false,
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

  it("assume autor Pessoa no evento gravado antes do autor bot", () => {
    const legacy = {
      id: "m1",
      conversation_id: "c1",
      client_id: "k1",
      author: { id: "p1", name: "Bruno Lima" },
      body: "Olá",
      created_at: "2026-11-09T12:00:00.000Z",
      edited_at: null,
      mentions: [],
      quote: null,
    } as unknown as Parameters<typeof messageFromEvent>[0];

    expect(messageFromEvent(legacy).author).toEqual({
      kind: "person",
      id: "p1",
      name: "Bruno Lima",
      username: "",
      initials: "BL",
    });
  });
});
