import { describe, expect, it } from "vitest";
import { BLOCKED_NOTICE, messageDisplayText, quoteDisplayText } from "./business-data";

const author = { kind: "bot" as const, id: "b1", name: "Assistente", username: "assistente" };

describe("messageDisplayText", () => {
  it("a Mensagem bloqueada mostra e copia o aviso", () => {
    expect(messageDisplayText({ body: "", blocked: true })).toBe(
      "Resposta com dados de negócio. Você não tem permissão para vê-la.",
    );
  });

  it("a Mensagem completa mostra e copia o texto", () => {
    expect(messageDisplayText({ body: "Faturamento de março: R$ 10,00.", blocked: false })).toBe(
      "Faturamento de março: R$ 10,00.",
    );
  });
});

describe("quoteDisplayText", () => {
  it("a citação bloqueada mostra o aviso", () => {
    expect(quoteDisplayText({ id: "m1", deleted: false, author, body: "", business_data: true, blocked: true })).toBe(
      BLOCKED_NOTICE,
    );
  });

  it("a citação completa mostra o texto, e a de antes da F13 também", () => {
    expect(quoteDisplayText({ id: "m1", deleted: false, author, body: "Oi" })).toBe("Oi");
  });
});
