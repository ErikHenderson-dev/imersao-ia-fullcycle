import { describe, expect, it } from "vitest";
import { splitMessageBody } from "./message-segments";

const ana = { id: "p1", username: "ana" };

describe("splitMessageBody", () => {
  it("divide o texto em texto, Menção e link", () => {
    expect(splitMessageBody("Oi @Ana, veja https://exemplo.com", [ana])).toEqual([
      { kind: "text", text: "Oi " },
      { kind: "mention", text: "@Ana", mention: ana },
      { kind: "text", text: ", veja " },
      { kind: "link", href: "https://exemplo.com" },
    ]);
  });

  it("deixa como texto o @usuário que não está em mentions e o @ de um e-mail", () => {
    expect(splitMessageBody("@bruno e ana@empresa.com", [ana])).toEqual([
      { kind: "text", text: "@bruno e ana@empresa.com" },
    ]);
  });

  it("sem Menções, só divide os links", () => {
    expect(splitMessageBody("@ana oi", [])).toEqual([{ kind: "text", text: "@ana oi" }]);
  });

  it("reconhece o @usuário de um Agente conectado", () => {
    expect(splitMessageBody("Oi @assistente, resuma", [], ["assistente"])).toEqual([
      { kind: "text", text: "Oi " },
      { kind: "agent", text: "@assistente", username: "assistente" },
      { kind: "text", text: ", resuma" },
    ]);
  });

  it("segue o limite de palavra das Menções gravadas com o @usuário de um Agente", () => {
    expect(
      splitMessageBody("@assistente2 x@assistente @assistente.com", [], ["assistente"]),
    ).toEqual([{ kind: "text", text: "@assistente2 x@assistente @assistente.com" }]);
  });

  it("dá a Menção à Pessoa quando ela e um Agente têm o mesmo @usuário", () => {
    const pessoa = { id: "p2", username: "assistente" };

    expect(splitMessageBody("@assistente", [pessoa], ["assistente"])).toEqual([
      { kind: "mention", text: "@assistente", mention: pessoa },
    ]);
  });

  it("sem a lista de Agentes, o @usuário de um Agente é texto", () => {
    expect(splitMessageBody("@assistente", [])).toEqual([{ kind: "text", text: "@assistente" }]);
  });
});
