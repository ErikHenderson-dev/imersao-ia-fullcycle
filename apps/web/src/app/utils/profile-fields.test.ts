import { describe, expect, it } from "vitest";
import { parseProfileFields } from "./profile-fields";

const VALID = { name: "Ana Lima", title: "Engenheira", phone: "+55 11 98888-0001" };

describe("parseProfileFields", () => {
  it("apara os campos e troca o cargo e o telefone vazios por nulo", () => {
    expect(parseProfileFields({ name: "  Ana Lima ", title: "  ", phone: "" })).toEqual({
      kind: "ok",
      fields: { name: "Ana Lima", title: null, phone: null },
    });
  });

  it("aceita os limites, contados em code points", () => {
    const result = parseProfileFields({
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
    const result = parseProfileFields({ name: "", title: "c".repeat(81), phone: "x" });
    expect(result.kind === "invalid" && result.errors.map((error) => error.field)).toEqual([
      "name",
      "title",
      "phone",
    ]);
  });

  it("recusa campo que não é texto", () => {
    expect(parseProfileFields({ ...VALID, name: 42 }).kind).toBe("invalid");
  });
});
