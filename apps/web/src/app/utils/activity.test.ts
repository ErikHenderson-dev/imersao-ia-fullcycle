import { describe, expect, it } from "vitest";
import type { MessageActivityItem, Task, TaskActivityItem } from "@/app/services/chat-api";
import {
  activityFilterFromParam,
  activityItemId,
  activityTabFromParam,
  isTaskNotificationRead,
  taskItemFromEvent,
  taskNotificationTitle,
  activityTabHref,
  isNotificationRead,
  notificationSuffix,
  notificationTitle,
  relativeTime,
  unreadSuffix,
} from "./activity";

function item(kind: MessageActivityItem["kind"]): Pick<MessageActivityItem, "kind" | "message"> & {
  conversation: { name: string };
} {
  return {
    kind,
    message: {
      id: "m",
      conversationId: "c",
      clientId: "x",
      author: { kind: "person", id: "a", name: "Rafael Trevisani", username: "pessoa", initials: "RT" },
      body: "Oi",
      createdAt: "2026-11-10T12:00:00.000Z",
      editedAt: null,
      mentions: [],
      quote: null,
      quickReplies: null,
      businessData: false,
      blocked: false,
      report: null,
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
    expect(activityTabFromParam(undefined)).toBe("all");
    expect(activityTabFromParam("mencoes")).toBe("mentions");
    expect(activityTabFromParam("diretas")).toBe("direct");
    expect(activityTabFromParam("tarefas")).toBe("tasks");
    expect(activityTabFromParam("outra")).toBe("all");
    expect(activityTabHref("all")).toBe("/atividade");
    expect(activityTabHref("direct")).toBe("/atividade?aba=diretas");
    expect(activityTabHref("tasks")).toBe("/atividade?aba=tarefas");
    expect(activityFilterFromParam(null)).toBe("all");
    expect(activityFilterFromParam("mentions")).toBe("mentions");
    expect(activityFilterFromParam("tarefas")).toBeNull();
    expect(activityFilterFromParam("tasks")).toBeNull();
  });
});

describe("Notificação de Tarefa", () => {
  const ana = { id: "ana", name: "Ana Souza", username: "ana" };
  const bruno = { id: "bruno", name: "Bruno Lima", username: "bruno" };
  const task: Task = {
    id: "t1",
    title: "Revisar o contrato",
    status: "open",
    createdAt: "2026-11-12T10:00:00.000Z",
    completedAt: null,
    assignee: bruno,
    delegator: ana,
    conversation: { id: "c1", name: "geral", kind: "public_channel" },
    triggerMessage: { id: "m1", deleted: false },
  };

  it("o título de cada tipo", () => {
    expect(taskNotificationTitle("received", "Ana Souza")).toBe("Ana Souza delegou uma Tarefa a você");
    expect(taskNotificationTitle("completed", "Bruno Lima")).toBe("Bruno Lima concluiu uma Tarefa");
    expect(taskNotificationTitle("reopened", "Bruno Lima")).toBe("Bruno Lima reabriu uma Tarefa");
  });

  it("quem agiu: quem delegou na recebida, o Responsável nas outras", () => {
    expect(taskItemFromEvent(task, { id: "n1", kind: "received" }).actor).toEqual(ana);
    expect(taskItemFromEvent(task, { id: "n2", kind: "completed" }).actor).toEqual(bruno);
    expect(activityItemId(taskItemFromEvent(task, { id: "n2", kind: "completed" }))).toBe("n2");
  });

  it("lida quando aberta ou pela marca", () => {
    const unread: TaskActivityItem = taskItemFromEvent(task, { id: "0005", kind: "received" });
    expect(isTaskNotificationRead(unread, null)).toBe(false);
    expect(isTaskNotificationRead(unread, "0004")).toBe(false);
    expect(isTaskNotificationRead(unread, "0005")).toBe(true);
    expect(isTaskNotificationRead({ ...unread, notification: { ...unread.notification, read: true } }, null)).toBe(true);
  });
});
