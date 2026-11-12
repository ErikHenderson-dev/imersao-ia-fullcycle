import type { QuotePayload } from "chat-events";
import { describe, expect, it } from "vitest";
import { BLOCKED_NOTICE, displayText } from "./business-data";

const author = { kind: "bot" as const, id: "b1", name: "Assistente", username: "assistente" };

describe("displayText", () => {
  it("a Mensagem bloqueada mostra e copia o aviso", () => {
    expect(displayText({ body: "", blocked: true })).toBe(
      "Resposta com dados de negócio. Você não tem permissão para vê-la.",
    );
  });

  it("a Mensagem completa mostra e copia o texto", () => {
    expect(displayText({ body: "Faturamento de março: R$ 10,00.", blocked: false })).toBe(
      "Faturamento de março: R$ 10,00.",
    );
  });

  it("a citação bloqueada mostra o aviso", () => {
    const quote: QuotePayload = { id: "m1", deleted: false, author, body: "", business_data: true, blocked: true };

    expect(displayText(quote)).toBe(BLOCKED_NOTICE);
  });

  it("a citação de antes da F13, sem blocked, mostra o texto", () => {
    const quote: QuotePayload = { id: "m1", deleted: false, author, body: "Oi" };

    expect(displayText(quote)).toBe("Oi");
  });
});
