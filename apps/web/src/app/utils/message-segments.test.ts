import { describe, expect, it } from "vitest";
import { splitMessageBody } from "./message-segments";

const ana = { id: "p1", username: "ana" };

describe("splitMessageBody", () => {
  it("divide o texto em texto, Menção e link", () => {
    expect(splitMessageBody("Oi @Ana, veja https://exemplo.com", [ana])).toEqual([
      { kind: "text", text: "Oi " },
      { kind: "mention", text: "@Ana", mention: ana },
      { kind: "text", text: ", veja " },
      { kind: "link", href: "https://exemplo.com" },
    ]);
  });

  it("deixa como texto o @usuário que não está em mentions e o @ de um e-mail", () => {
    expect(splitMessageBody("@bruno e ana@empresa.com", [ana])).toEqual([
      { kind: "text", text: "@bruno e ana@empresa.com" },
    ]);
  });

  it("sem Menções, só divide os links", () => {
    expect(splitMessageBody("@ana oi", [])).toEqual([{ kind: "text", text: "@ana oi" }]);
  });
});
