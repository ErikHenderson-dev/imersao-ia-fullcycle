import { describe, expect, it } from "vitest";
import { compareCursors, laterCursor, orderForSync } from "./event-cursor";

describe("compareCursors", () => {
  it("compara pelos milissegundos e depois pela sequência", () => {
    expect(compareCursors("e:10-0", "e:9-5")).toBeGreaterThan(0);
    expect(compareCursors("e:10-1", "e:10-2")).toBeLessThan(0);
  });

  it("não compara cursores de épocas diferentes", () => {
    expect(compareCursors("a:10-0", "b:1-0")).toBe(0);
  });
});

describe("laterCursor", () => {
  it("fica com o maior da mesma época", () => {
    expect(laterCursor("e:10-0", "e:9-0")).toBe("e:10-0");
    expect(laterCursor("e:10-0", "e:11-0")).toBe("e:11-0");
  });

  it("troca para o cursor de outra época", () => {
    expect(laterCursor("a:10-0", "b:1-0")).toBe("b:1-0");
  });

  it("mantém o atual sem cursor novo", () => {
    expect(laterCursor("e:10-0", undefined)).toBe("e:10-0");
  });
});

describe("orderForSync", () => {
  it("ordena pelo cursor, sem repetir, e deixa os sem cursor no fim", () => {
    const events = [
      { event_id: "e:3-0", name: "c" },
      { name: "sem cursor" },
      { event_id: "e:1-0", name: "a" },
      { event_id: "e:3-0", name: "c repetido" },
      { event_id: "e:2-0", name: "b" },
    ];

    expect(orderForSync(events, (event) => event.event_id).map((event) => event.name)).toEqual(["a", "b", "c", "sem cursor"]);
  });
});
