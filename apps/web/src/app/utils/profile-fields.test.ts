import { describe, expect, it } from "vitest";
import { parseProfileFields } from "./profile-fields";

const VALID = {
  name: "Ana Lima",
  title: "Engenheira",
  phone: "+55 11 98888-0001",
  statusEmoji: null,
  statusText: "",
};

describe("parseProfileFields", () => {
  it("apara os campos e troca o cargo e o telefone vazios por nulo", () => {
    expect(parseProfileFields({ ...VALID, name: "  Ana Lima ", title: "  ", phone: "" })).toEqual({
      kind: "ok",
      fields: { name: "Ana Lima", title: null, phone: null, statusEmoji: null, statusText: null },
    });
  });

  it("aceita os limites, contados em code points", () => {
    const result = parseProfileFields({
      ...VALID,
      statusText: "s".repeat(100),
      name: "😀".repeat(80),
      title: "c".repeat(80),
      phone: "9".repeat(30),
    });
    expect(result.kind).toBe("ok");
  });

  it.each([
    ["o nome vazio", { name: "   " }, "name", "Informe seu nome completo."],
    ["o nome com quebra de linha", { name: "Ana\nLima" }, "name", "O nome precisa ficar numa linha só."],
    ["o nome com 81 caracteres", { name: "n".repeat(81) }, "name", "O nome pode ter no máximo 80 caracteres."],
    ["o cargo com 81 caracteres", { title: "c".repeat(81) }, "title", "O cargo pode ter no máximo 80 caracteres."],
    ["o cargo com quebra de linha", { title: "a\nb" }, "title", "O cargo precisa ficar numa linha só."],
    ["o nome com o caractere nulo", { name: "Ana\u0000" }, "name", "O nome tem um caractere inválido."],
    ["o cargo com o caractere nulo", { title: "Produto\u0000" }, "title", "O cargo tem um caractere inválido."],
    [
      "o telefone com letra",
      { phone: "+55 11 ABCD" },
      "phone",
      "O telefone aceita só dígitos, espaço, +, -, ( e ), até 30 caracteres.",
    ],
    [
      "o telefone com 31 caracteres",
      { phone: "9".repeat(31) },
      "phone",
      "O telefone aceita só dígitos, espaço, +, -, ( e ), até 30 caracteres.",
    ],
  ])("recusa %s com a mensagem do campo", (_case, change, field, message) => {
    expect(parseProfileFields({ ...VALID, ...change })).toEqual({
      kind: "invalid",
      errors: [{ field, message }],
    });
  });

  it("devolve o erro de cada campo, na ordem da tela", () => {
    const result = parseProfileFields({ ...VALID, name: "", title: "c".repeat(81), phone: "x" });
    expect(result.kind === "invalid" && result.errors.map((error) => error.field)).toEqual([
      "name",
      "title",
      "phone",
    ]);
  });

  it("a mensagem de status sem emoji ganha o speech, e com emoji fica com ele", () => {
    const onlyText = parseProfileFields({ ...VALID, statusText: " Em reunião " });
    const withEmoji = parseProfileFields({ ...VALID, statusEmoji: "vacation", statusText: "" });

    expect(onlyText.kind === "ok" && onlyText.fields).toMatchObject({
      statusEmoji: "speech",
      statusText: "Em reunião",
    });
    expect(withEmoji.kind === "ok" && withEmoji.fields).toMatchObject({
      statusEmoji: "vacation",
      statusText: null,
    });
  });

  it.each([
    ["com 101 caracteres", "s".repeat(101), "A mensagem de status pode ter no máximo 100 caracteres."],
    ["com quebra de linha", "a\nb", "A mensagem de status precisa ficar numa linha só."],
  ])("recusa a mensagem de status %s", (_case, statusText, message) => {
    expect(parseProfileFields({ ...VALID, statusText })).toEqual({
      kind: "invalid",
      errors: [{ field: "statusText", message }],
    });
  });

  it("recusa a chave de emoji fora das sete", () => {
    expect(parseProfileFields({ ...VALID, statusEmoji: "party" }).kind).toBe("invalid");
  });

  it("recusa o campo que não é texto, apontando para ele", () => {
    expect(parseProfileFields({ ...VALID, title: 42 })).toEqual({
      kind: "invalid",
      errors: [{ field: "title", message: "Dados inválidos." }],
    });
  });
});
