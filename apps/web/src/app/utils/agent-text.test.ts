import { describe, expect, it } from "vitest";
import { parseAgentText } from "./agent-text";

const plain = (text: string) => [{ text, bold: false }];

describe("parseAgentText", () => {
  it("converte o cabeçalho com #", () => {
    expect(parseAgentText("# Resumo de hoje · 3 Mensagens")).toEqual([
      { kind: "heading", spans: plain("Resumo de hoje · 3 Mensagens") },
    ]);
  });

  it("aceita ## e ### como cabeçalho", () => {
    expect(parseAgentText("## Decisões\n### Pendências")).toEqual([
      { kind: "heading", spans: plain("Decisões") },
      { kind: "heading", spans: plain("Pendências") },
    ]);
  });

  it("junta linhas seguidas com - numa lista", () => {
    expect(parseAgentText("- primeiro\n- segundo")).toEqual([
      { kind: "list", items: [plain("primeiro"), plain("segundo")] },
    ]);
  });

  it("separa parágrafos por linha em branco e mantém as quebras de linha", () => {
    expect(parseAgentText("linha um\nlinha dois\n\noutro parágrafo")).toEqual([
      { kind: "paragraph", spans: plain("linha um\nlinha dois") },
      { kind: "paragraph", spans: plain("outro parágrafo") },
    ]);
  });

  it("converte **negrito** em qualquer bloco", () => {
    expect(parseAgentText("# **Resumo**\n- **Ana Souza:** abriu o canal\n\nTexto **forte** aqui")).toEqual([
      { kind: "heading", spans: [{ text: "Resumo", bold: true }] },
      {
        kind: "list",
        items: [
          [
            { text: "Ana Souza:", bold: true },
            { text: " abriu o canal", bold: false },
          ],
        ],
      },
      {
        kind: "paragraph",
        spans: [
          { text: "Texto ", bold: false },
          { text: "forte", bold: true },
          { text: " aqui", bold: false },
        ],
      },
    ]);
  });

  it("monta o resumo inteiro na ordem: cabeçalho, parágrafo e lista", () => {
    const blocks = parseAgentText(
      "# Resumo de tudo · 500 de 620 Mensagens\nO Recorte tem 620 Mensagens.\n- **Bruno Lima:** a virada é no sábado.",
    );

    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "list"]);
  });

  it.each([
    ["uma tabela", "| mês | pedidos |\n| --- | --- |"],
    ["uma lista numerada", "1. primeiro\n2. segundo"],
    ["** sem par", "isso **não fecha"],
    ["marcação HTML", "<b>forte</b> <a href=\"x\">link</a>"],
    ["um endereço", "veja https://exemplo.com/pagina"],
    ["# sem espaço", "#geral"],
  ])("deixa %s como texto num parágrafo", (_case, text) => {
    expect(parseAgentText(text)).toEqual([{ kind: "paragraph", spans: plain(text) }]);
  });

  it("ignora linhas em branco nas pontas e não devolve blocos para texto vazio", () => {
    expect(parseAgentText("\n\n  \n")).toEqual([]);
    expect(parseAgentText("\n- item\n\n")).toEqual([{ kind: "list", items: [plain("item")] }]);
  });
});
