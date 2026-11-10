import { describe, expect, it } from "vitest";
import type { ActivityItem, ActivityPage, Message } from "@/app/services/chat-api";
import { applyCreated, applyDeleted, applyUpdated, notificationKindFor } from "./activity-cache";

const ME = "me";

function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: "c",
    clientId: id,
    author: { id: "other", name: "Ana", initials: "AN" },
    body: `Mensagem ${id}`,
    createdAt: "2026-11-10T12:00:00.000Z",
    editedAt: null,
    mentions: [],
    quote: null,
    ...overrides,
  };
}

function item(id: string, kind: ActivityItem["kind"] = "mention"): ActivityItem {
  return {
    kind,
    message: message(id),
    conversation: {
      id: "c",
      kind: kind === "direct" ? "direct" : "public_channel",
      name: "geral",
      topic: null,
      memberCount: 2,
      counterpart: null,
      lastReadMessageId: null,
      unreadCount: 0,
      mentionCount: 0,
    },
  };
}

function ids(pages: ActivityPage[]): string[][] {
  return pages.map((page) => page.items.map((entry) => entry.message.id));
}

describe("Atividade no cache", () => {
  it("a Mensagem é Notificação para a Pessoa", () => {
    const mentioning = message("1", { mentions: [{ id: ME, username: "eu" }] });
    expect(notificationKindFor(mentioning, { kind: "public_channel" }, ME)).toBe("mention");
    expect(notificationKindFor(message("2"), { kind: "private_channel" }, ME)).toBeNull();
    expect(notificationKindFor(message("3"), { kind: "direct" }, ME)).toBe("direct");
    const own = message("4", { author: { id: ME, name: "Eu", initials: "EU" } });
    expect(notificationKindFor(own, { kind: "direct" }, ME)).toBeNull();
    expect(notificationKindFor(mentioning, undefined, ME)).toBeNull();
  });

  it("a nova entra no topo da aba do tipo dela", () => {
    const pages: ActivityPage[] = [{ items: [item("2"), item("3")], hasMore: true }];

    expect(ids(applyCreated(pages, item("4"), "all"))).toEqual([["2", "3", "4"]]);
    expect(ids(applyCreated(pages, item("4", "direct"), "mentions"))).toEqual([["2", "3"]]);
    expect(ids(applyCreated(pages, item("3"), "all"))).toEqual([["2", "3"]]);
    expect(ids(applyCreated([], item("1"), "all"))).toEqual([["1"]]);
  });

  it("a edição troca o texto, põe ou tira pela Menção", () => {
    const pages: ActivityPage[] = [
      { items: [item("5"), item("7")], hasMore: true },
      { items: [item("2"), item("3")], hasMore: true },
    ];
    const edited = message("7", { body: "Editada" });

    expect(applyUpdated(pages, edited, { ...item("7"), message: edited }, "all")[0].items[1].message.body).toBe(
      "Editada",
    );
    expect(ids(applyUpdated(pages, message("7"), null, "all"))).toEqual([["5"], ["2", "3"]]);
    expect(ids(applyUpdated(pages, message("4"), item("4"), "all"))).toEqual([
      ["5", "7"],
      ["2", "3", "4"],
    ]);
    expect(ids(applyUpdated(pages, message("6"), item("6"), "all"))).toEqual([
      ["5", "6", "7"],
      ["2", "3"],
    ]);
    // Mais antiga que tudo o que está carregado, com páginas por vir: fica para a página dela.
    expect(ids(applyUpdated(pages, message("1"), item("1"), "all"))).toEqual([
      ["5", "7"],
      ["2", "3"],
    ]);
  });

  it("a apagada sai", () => {
    const pages: ActivityPage[] = [{ items: [item("2"), item("3")], hasMore: false }];

    expect(ids(applyDeleted(pages, "2"))).toEqual([["3"]]);
  });
});
