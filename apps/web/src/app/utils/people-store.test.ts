import { describe, expect, it, vi } from "vitest";
import { createPeopleStore, displayedPerson } from "./people-store";

const ANA = { id: "1", name: "Ana Souza", username: "ana", title: null };

describe("camada de Pessoas", () => {
  it("começa pela Pessoa da Sessão, com as iniciais", () => {
    const store = createPeopleStore([ANA]);

    expect(store.get("1")).toEqual({ ...ANA, initials: "AS" });
  });

  it("troca o nome, as iniciais e o cargo da Pessoa que mudou e avisa quem assina", () => {
    const store = createPeopleStore([ANA, { id: "2", name: "Bruno", username: "bruno", title: null }]);
    const other = store.get("2");
    const listener = vi.fn();
    store.subscribe(listener);

    store.apply({ ...ANA, name: "Ana Lima", title: "Produto" });

    expect(store.get("1")).toEqual({ ...ANA, name: "Ana Lima", title: "Produto", initials: "AL" });
    expect(store.get("2")).toBe(other);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("não avisa quando nada mudou, e a entrada continua o mesmo objeto", () => {
    const store = createPeopleStore([ANA]);
    const before = store.get("1");
    const listener = vi.fn();
    store.subscribe(listener);

    store.apply({ ...ANA });

    expect(store.get("1")).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("guarda quem ainda não conhecia", () => {
    const store = createPeopleStore();

    store.apply(ANA);

    expect(store.get("1")?.name).toBe("Ana Souza");
  });
});

describe("displayedPerson", () => {
  const fromPayload = { id: "1", name: "Ana Souza", initials: "AS", extra: true };

  it("usa o payload quando a camada não conhece a Pessoa", () => {
    expect(displayedPerson(undefined, fromPayload)).toBe(fromPayload);
  });

  it("usa o nome e as iniciais da camada, mantendo o resto do payload", () => {
    expect(displayedPerson({ ...ANA, name: "Ana Lima", initials: "AL" }, fromPayload)).toEqual({
      ...fromPayload,
      name: "Ana Lima",
      initials: "AL",
    });
  });
});
