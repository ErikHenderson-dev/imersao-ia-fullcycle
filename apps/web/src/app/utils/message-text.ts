// Tamanho máximo da Mensagem, em pontos de código, como a API e o banco (LLD, "Valores e
// configuração").
export const MESSAGE_MAX_LENGTH = 4000;

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

// O texto pronto para gravar, como a API o valida (sem as pontas, não vazio e dentro do limite), ou
// null quando não serve: o envio e a edição usam a mesma regra.
export function messageBodyToSave(body: unknown): string | null {
  const text = typeof body === "string" ? body.trim() : "";
  if (text === "" || codePointLength(text) > MESSAGE_MAX_LENGTH) return null;
  return text;
}

// Quantos caracteres o texto passa do limite (zero ou negativo quando cabe).
export function overLimitBy(text: string): number {
  return codePointLength(text.trim()) - MESSAGE_MAX_LENGTH;
}

// O aviso de acima do limite, da caixa de mensagem e da edição.
export function overLimitLabel(overLimit: number): string {
  return overLimit === 1 ? "1 caractere acima do limite" : `${overLimit} caracteres acima do limite`;
}
