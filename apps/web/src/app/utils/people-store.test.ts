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

  it("na reconexão esquece as outras Pessoas e guarda a da Sessão", () => {
    const store = createPeopleStore([ANA]);
    store.apply(BRUNO);

    store.forgetAllBut("1");

    expect(store.get("2")).toBeUndefined();
    expect(store.get("1")?.name).toBe("Ana Souza");
  });
});
