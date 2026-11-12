import { describe, expect, it } from "vitest";
import type { Task, TaskPage } from "@/app/services/chat-api";
import { mergeTask, taskConversationLabel, taskDate, taskFromPayload, taskRoles, toggledTask } from "./tasks";

const ANA = { id: "ana", name: "Ana Souza", username: "ana" };
const BRUNO = { id: "bruno", name: "Bruno Lima", username: "bruno" };

function task(id: string, status: Task["status"] = "open", assignee = BRUNO): Task {
  return {
    id,
    title: `Tarefa ${id}`,
    status,
    createdAt: "2026-11-12T10:00:00.000Z",
    completedAt: status === "done" ? "2026-11-12T11:00:00.000Z" : null,
    assignee,
    delegator: ANA,
    conversation: { id: "c1", name: "geral", kind: "public_channel" },
    triggerMessage: { id: `m-${id}`, deleted: false },
  };
}

function ids(pages: TaskPage[]): string[][] {
  return pages.map((page) => page.tasks.map((entry) => entry.id));
}

describe("taskRoles", () => {
  it("diz se a Pessoa recebeu, delegou ou as duas coisas", () => {
    expect(taskRoles(task("1"), "bruno")).toEqual(["assigned"]);
    expect(taskRoles(task("1"), "ana")).toEqual(["delegated"]);
    expect(taskRoles(task("1", "open", ANA), "ana")).toEqual(["assigned", "delegated"]);
    expect(taskRoles(task("1"), "caio")).toEqual([]);
  });
});

describe("mergeTask", () => {
  it("põe a Tarefa nova no topo das abertas", () => {
    const pages: TaskPage[] = [{ tasks: [task("05"), task("03", "done")], nextCursor: null }];

    expect(ids(mergeTask(pages, task("07"), "assigned", "bruno"))).toEqual([["07", "05", "03"]]);
  });

  it("move a Tarefa concluída para depois das abertas", () => {
    const pages: TaskPage[] = [{ tasks: [task("07"), task("05"), task("03", "done")], nextCursor: null }];

    expect(ids(mergeTask(pages, task("07", "done"), "assigned", "bruno"))).toEqual([["05", "07", "03"]]);
  });

  it("não põe a Tarefa depois da última página carregada quando há mais", () => {
    const pages: TaskPage[] = [{ tasks: [task("07"), task("05")], nextCursor: "open.05" }];

    expect(ids(mergeTask(pages, task("01", "done"), "assigned", "bruno"))).toEqual([["07", "05"]]);
  });

  it("põe a Tarefa na página certa, sem mudar as outras", () => {
    const pages: TaskPage[] = [
      { tasks: [task("09"), task("08")], nextCursor: "open.08" },
      { tasks: [task("04"), task("02", "done")], nextCursor: null },
    ];

    expect(ids(mergeTask(pages, task("06"), "assigned", "bruno"))).toEqual([
      ["09", "08"],
      ["06", "04", "02"],
    ]);
  });

  it("tira a Tarefa de um grupo que não é o da Pessoa", () => {
    const pages: TaskPage[] = [{ tasks: [task("07")], nextCursor: null }];

    expect(ids(mergeTask(pages, task("07"), "delegated", "bruno"))).toEqual([[]]);
  });
});

describe("taskFromPayload", () => {
  it("traz a Tarefa da API para o formato da web", () => {
    expect(
      taskFromPayload({
        id: "1",
        title: "Revisar",
        status: "open",
        created_at: "2026-11-12T10:00:00.000Z",
        completed_at: null,
        assignee: BRUNO,
        delegator: ANA,
        conversation: { id: "c1", name: "geral", kind: "public_channel" },
        trigger_message: { id: "m1", deleted: true },
      }),
    ).toEqual({
      id: "1",
      title: "Revisar",
      status: "open",
      createdAt: "2026-11-12T10:00:00.000Z",
      completedAt: null,
      assignee: BRUNO,
      delegator: ANA,
      conversation: { id: "c1", name: "geral", kind: "public_channel" },
      triggerMessage: { id: "m1", deleted: true },
    });
  });
});

describe("taskConversationLabel e taskDate", () => {
  it("mostra o Canal com # e a Conversa direta pelo tipo", () => {
    expect(taskConversationLabel(task("1"))).toBe("#geral");
    expect(taskConversationLabel({ conversation: { id: "d", name: null, kind: "direct" } })).toBe("Conversa direta");
  });

  it("mostra a data como 10 nov, no fuso de quem vê", () => {
    expect(taskDate("2026-11-10T12:00:00.000Z", "America/Sao_Paulo")).toBe("10 nov");
    expect(taskDate("2026-11-11T01:00:00.000Z", "America/Sao_Paulo")).toBe("10 nov");
  });
});

describe("toggledTask", () => {
  it("conclui a aberta e reabre a concluída", () => {
    expect(toggledTask(task("1"))).toMatchObject({ action: "complete", next: { status: "done" } });
    expect(toggledTask(task("1", "done"))).toMatchObject({ action: "reopen", next: { status: "open", completedAt: null } });
  });
});
