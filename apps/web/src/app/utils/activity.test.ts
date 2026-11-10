import { describe, expect, it } from "vitest";
import type { ActivityItem } from "@/app/services/chat-api";
import {
  activityFilterFromParam,
  activityFilterFromTab,
  activityTabHref,
  isNotificationRead,
  notificationSuffix,
  notificationTitle,
  relativeTime,
  unreadSuffix,
} from "./activity";

function item(kind: ActivityItem["kind"]): Pick<ActivityItem, "kind" | "message"> & {
  conversation: { name: string };
} {
  return {
    kind,
    message: {
      id: "m",
      conversationId: "c",
      clientId: "x",
      author: { id: "a", name: "Rafael Trevisani", initials: "RT" },
      body: "Oi",
      createdAt: "2026-11-10T12:00:00.000Z",
      editedAt: null,
      mentions: [],
      quote: null,
    },
    conversation: { name: "geral" },
  };
}

describe("Atividade", () => {
  it("o título do item", () => {
    expect(notificationTitle(item("mention"))).toBe("Rafael Trevisani mencionou você em #geral");
    expect(notificationTitle(item("direct"))).toBe("Rafael Trevisani enviou uma mensagem direta");
  });

  it("o tempo relativo", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    const zone = "America/Sao_Paulo";
    expect(relativeTime("2026-11-10T11:59:30.000Z", now, zone)).toBe("agora");
    expect(relativeTime("2026-11-10T11:55:00.000Z", now, zone)).toBe("há 5 min");
    expect(relativeTime("2026-11-10T10:00:00.000Z", now, zone)).toBe("há 2 h");
    expect(relativeTime("2026-11-03T15:00:00.000Z", now, zone)).toBe("3 de nov.");
  });

  it("lida pela Última leitura", () => {
    expect(isNotificationRead("0002", null)).toBe(false);
    expect(isNotificationRead("0002", "0001")).toBe(false);
    expect(isNotificationRead("0002", "0002")).toBe(true);
    expect(isNotificationRead("0001", "0002")).toBe(true);
    // A marca de "Marcar tudo como lido" também lê.
    expect(isNotificationRead("0002", "0001", "0003")).toBe(true);
    expect(isNotificationRead("0004", "0001", "0003")).toBe(false);
  });

  it("o nome acessível do item", () => {
    expect(notificationSuffix(false)).toBe(", não lida");
    expect(notificationSuffix(true)).toBe("");
  });

  it("o nome acessível do link Atividade", () => {
    expect(unreadSuffix(0)).toBe("");
    expect(unreadSuffix(1)).toBe(", 1 não lida");
    expect(unreadSuffix(3)).toBe(", 3 não lidas");
    expect(unreadSuffix(100)).toBe(", mais de 99 não lidas");
  });

  it("a aba da URL e o caminho de cada aba", () => {
    expect(activityFilterFromTab(undefined)).toBe("all");
    expect(activityFilterFromTab("mencoes")).toBe("mentions");
    expect(activityFilterFromTab("diretas")).toBe("direct");
    expect(activityFilterFromTab("tarefas")).toBe("all");
    expect(activityTabHref("all")).toBe("/atividade");
    expect(activityTabHref("direct")).toBe("/atividade?aba=diretas");
    expect(activityFilterFromParam(null)).toBe("all");
    expect(activityFilterFromParam("mentions")).toBe("mentions");
    expect(activityFilterFromParam("tarefas")).toBeNull();
  });
});
