import { describe, expect, it, vi } from "vitest";
import { createPeopleStore } from "./people-store";

const ANA = { id: "1", name: "Ana Souza" };
const BRUNO = { id: "2", name: "Bruno Lima" };

describe("camada de Pessoas", () => {
  it("começa pela Pessoa da Sessão, com as iniciais", () => {
    const store = createPeopleStore([ANA]);

    expect(store.get("1")).toEqual({ ...ANA, initials: "AS" });
  });

  it("troca o nome e as iniciais da Pessoa que mudou e avisa quem assina", () => {
    const store = createPeopleStore([ANA, BRUNO]);
    const bruno = store.get("2");
    const listener = vi.fn();
    store.subscribe(listener);

    const changed = store.apply({ id: "1", name: "Ana Lima" });

    expect(changed).toBe(true);
    expect(store.get("1")).toEqual({ id: "1", name: "Ana Lima", initials: "AL" });
    expect(store.get("2")).toBe(bruno);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.version()).toBe(1);
  });

  it("não avisa quando o nome é o mesmo, e a entrada continua o mesmo objeto", () => {
    const store = createPeopleStore([ANA]);
    const before = store.get("1");
    const listener = vi.fn();
    store.subscribe(listener);

    const changed = store.apply({ ...ANA });

    expect(changed).toBe(false);
    expect(store.get("1")).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("troca o cargo sem mudar o nome, e o cargo ausente fica como estava", () => {
    const store = createPeopleStore([ANA]);

    expect(store.apply({ ...ANA, username: "ana", title: "Produto" })).toBe(true);
    expect(store.get("1")?.title).toBe("Produto");
    expect(store.apply({ ...ANA })).toBe(false);
    expect(store.get("1")?.title).toBe("Produto");
  });

  it("na reconexão esquece as outras Pessoas e guarda a da Sessão", () => {
    const store = createPeopleStore([ANA]);
    store.apply(BRUNO);

    store.forgetAllBut("1");

    expect(store.get("2")).toBeUndefined();
    expect(store.get("1")?.name).toBe("Ana Souza");
  });
});

describe("Status na camada de Pessoas", () => {
  const VACATION = { emoji: "vacation" as const, text: "De férias" };

  it("antes do retrato não sabe; depois, quem não está nele fica sem Status", () => {
    const store = createPeopleStore([ANA]);
    expect(store.getStatus("1")).toBeUndefined();

    store.applySnapshot([{ id: "2", status: VACATION }], store.snapshotMark());

    expect(store.getStatus("2")).toEqual(VACATION);
    expect(store.getStatus("1")).toBeNull();
  });

  it("o retrato novo troca o anterior", () => {
    const store = createPeopleStore();
    store.applySnapshot([{ id: "2", status: VACATION }], store.snapshotMark());

    store.applySnapshot([], store.snapshotMark());

    expect(store.getStatus("2")).toBeNull();
  });

  it("o person.updated troca o Status e avisa, mesmo sem mudar o nome", () => {
    const store = createPeopleStore([ANA]);
    store.applySnapshot([], store.snapshotMark());
    const listener = vi.fn();
    store.subscribe(listener);

    const changed = store.apply({ ...ANA, status: VACATION });

    expect(changed).toBe(true);
    expect(store.getStatus("1")).toEqual(VACATION);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.apply({ ...ANA, status: { ...VACATION } })).toBe(false);
  });

  it("um retrato lido antes de uma mudança não a desfaz", () => {
    const store = createPeopleStore([ANA]);
    const mark = store.snapshotMark();
    store.apply({ ...ANA, status: VACATION });

    store.applySnapshot([], mark);

    expect(store.getStatus("1")).toEqual(VACATION);
  });

  it("o mesmo retrato não avisa e guarda os objetos", () => {
    const store = createPeopleStore();
    store.applySnapshot([{ id: "2", status: VACATION }], store.snapshotMark());
    const before = store.getStatus("2");
    const listener = vi.fn();
    store.subscribe(listener);

    store.applySnapshot([{ id: "2", status: { ...VACATION } }], store.snapshotMark());

    expect(store.getStatus("2")).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });
});
