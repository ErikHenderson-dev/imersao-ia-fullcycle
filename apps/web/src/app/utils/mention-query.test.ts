import { describe, expect, it } from "vitest";
import { applyMention, findMentionQuery, insertAt } from "./mention-query";

describe("findMentionQuery", () => {
  it("acha o @ no começo e depois de espaço ou quebra de linha", () => {
    expect(findMentionQuery("@an", 3)).toEqual({ start: 0, query: "an" });
    expect(findMentionQuery("Oi @", 4)).toEqual({ start: 3, query: "" });
    expect(findMentionQuery("linha\n@br", 9)).toEqual({ start: 6, query: "br" });
  });

  it("ignora o @ de um e-mail, com espaço depois ou longe do cursor", () => {
    expect(findMentionQuery("ana@emp", 7)).toBeNull();
    expect(findMentionQuery("@ana oi", 7)).toBeNull();
    expect(findMentionQuery("@ana oi", 2)).toEqual({ start: 0, query: "a" });
  });
});

describe("applyMention", () => {
  it("troca o @texto por @usuario e um espaço, com o cursor depois dele", () => {
    const text = "Oi @an tudo bem";
    expect(applyMention(text, { start: 3, query: "an" }, 6, "ana")).toEqual({
      text: "Oi @ana tudo bem",
      caret: 8,
    });
  });
});

describe("insertAt", () => {
  it("insere o @, com espaço antes quando precisa", () => {
    expect(insertAt("", 0)).toEqual({ text: "@", caret: 1 });
    expect(insertAt("Oi", 2)).toEqual({ text: "Oi @", caret: 4 });
    expect(insertAt("Oi ", 3)).toEqual({ text: "Oi @", caret: 4 });
  });
});
