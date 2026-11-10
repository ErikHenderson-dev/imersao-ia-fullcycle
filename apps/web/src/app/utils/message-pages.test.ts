import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import {
  appendToLatestPage,
  flattenPages,
  patchQuotes,
  removeDeleted,
  replaceEdited,
} from "./message-pages";

function message(id: string): Message {
  return {
    id,
    conversationId: "c1",
    clientId: `client-${id}`,
    author: { id: "p1", name: "Ana Souza", initials: "AS" },
    body: `Mensagem ${id}`,
    createdAt: "2026-11-09T12:00:00.000Z",
    editedAt: null,
    mentions: [],
    quote: null,
  };
}

describe("flattenPages", () => {
  it("põe as páginas anteriores antes da mais recente, em ordem cronológica", () => {
    const pages = [
      { messages: [message("5"), message("6")], hasMore: true },
      { messages: [message("3"), message("4")], hasMore: true },
      { messages: [message("1"), message("2")], hasMore: false },
    ];

    expect(flattenPages(pages).map((item) => item.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("devolve uma lista vazia sem páginas", () => {
    expect(flattenPages([])).toEqual([]);
  });
});

describe("appendToLatestPage", () => {
  it("acrescenta a Mensagem no fim da página mais recente", () => {
    const older = { messages: [message("1")], hasMore: false };
    const pages = [{ messages: [message("2")], hasMore: true }, older];

    const result = appendToLatestPage(pages, message("3"));

    expect(result[0].messages.map((item) => item.id)).toEqual(["2", "3"]);
    expect(result[1]).toBe(older);
  });

  it("não repete uma Mensagem que já está na página", () => {
    const pages = [{ messages: [message("1")], hasMore: false }];

    expect(appendToLatestPage(pages, message("1"))).toBe(pages);
  });

  it("põe na ordem do id uma Mensagem mais antiga que as do fim", () => {
    const pages = [{ messages: [message("1"), message("3")], hasMore: false }];

    expect(appendToLatestPage(pages, message("2"))[0].messages.map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("não repete uma Mensagem que está numa página anterior", () => {
    const pages = [
      { messages: [message("3")], hasMore: true },
      { messages: [message("1")], hasMore: false },
    ];

    expect(appendToLatestPage(pages, message("1"))).toBe(pages);
  });

  it.each([
    ["com uma página e mais histórico atrás", [{ messages: [message("5"), message("6")], hasMore: true }]],
    [
      "com páginas anteriores carregadas",
      [
        { messages: [message("5"), message("6")], hasMore: true },
        { messages: [message("3"), message("4")], hasMore: false },
      ],
    ],
  ])("deixa de fora uma Mensagem mais antiga que o começo de pages[0] %s", (_caso, pages) => {
    expect(appendToLatestPage(pages, message("4a"))).toBe(pages);
  });

  it("encaixa uma Mensagem mais antiga quando o histórico inteiro está carregado", () => {
    const pages = [{ messages: [message("5"), message("6")], hasMore: false }];

    expect(appendToLatestPage(pages, message("4"))[0].messages.map((item) => item.id)).toEqual([
      "4",
      "5",
      "6",
    ]);
  });

  it("cria a página mais recente quando não há nenhuma", () => {
    expect(appendToLatestPage([], message("1"))).toEqual([
      { messages: [message("1")], hasMore: false },
    ]);
  });
});

describe("replaceEdited", () => {
  const edited = (id: string, at: string, body = "Texto novo"): Message => ({
    ...message(id),
    body,
    editedAt: at,
  });

  it("troca pelo id só com editedAt mais novo", () => {
    const pages = [{ messages: [message("a"), message("b")], hasMore: false }];

    const next = replaceEdited(pages, edited("b", "2026-11-09T12:05:00.000Z"));

    expect(next[0].messages.map((item) => item.body)).toEqual(["Mensagem a", "Texto novo"]);
  });

  it("descarta a edição atrasada", () => {
    const pages = [
      { messages: [edited("a", "2026-11-09T12:05:00.000Z", "Mais nova")], hasMore: false },
    ];

    const next = replaceEdited(pages, edited("a", "2026-11-09T12:04:00.000Z", "Atrasada"));

    expect(next).toBe(pages);
  });

  it("não insere Mensagem fora do cache", () => {
    const pages = [{ messages: [message("a")], hasMore: false }];

    const next = replaceEdited(pages, edited("z", "2026-11-09T12:05:00.000Z"));

    expect(next).toBe(pages);
  });
});

describe("removeDeleted", () => {
  it("tira a Mensagem pelo id, em qualquer página", () => {
    const pages = [
      { messages: [message("c")], hasMore: true },
      { messages: [message("a"), message("b")], hasMore: false },
    ];

    const next = removeDeleted(pages, "a");

    expect(flattenPages(next).map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("a edição depois da exclusão não traz a Mensagem de volta", () => {
    const pages = removeDeleted([{ messages: [message("a")], hasMore: false }], "a");

    const next = replaceEdited(pages, { ...message("a"), editedAt: "2026-11-09T12:05:00.000Z" });

    expect(flattenPages(next)).toEqual([]);
  });
});

describe("patchQuotes", () => {
  const quoting = (id: string, quotedId: string, body = "Mensagem a"): Message => ({
    ...message(id),
    quote: {
      id: quotedId,
      deleted: false,
      author: { id: "p1", name: "Ana Souza" },
      body,
    },
  });

  it("a edição atualiza as quote que citam a editada", () => {
    const pages = [{ messages: [message("a"), quoting("b", "a")], hasMore: false }];
    const edited = { ...message("a"), body: "Texto novo", editedAt: "2026-11-09T12:05:00.000Z" };

    const next = patchQuotes(pages, { id: "a", edited });

    expect(next[0].messages[1].quote).toMatchObject({ body: "Texto novo" });
  });

  it("a exclusão marca as quote, e a quote apagada não volta com uma edição", () => {
    const pages = [{ messages: [quoting("b", "a")], hasMore: false }];

    const deleted = patchQuotes(pages, { id: "a", deleted: true });
    const late = patchQuotes(deleted, {
      id: "a",
      edited: { ...message("a"), body: "Atrasada", editedAt: "2026-11-09T12:05:00.000Z" },
    });

    expect(deleted[0].messages[0].quote).toEqual({ id: "a", deleted: true });
    expect(late).toBe(deleted);
  });
});
