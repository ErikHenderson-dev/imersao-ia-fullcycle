// O `@` que a pessoa está digitando, na caixa de mensagem ou na edição (spec da F06, "Lista de
// menções"): logo antes do cursor, no começo do texto ou depois de espaço ou quebra de linha, e sem
// espaço entre ele e o cursor.
export type MentionQuery = { start: number; query: string };

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]*)$/u.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

// Troca o `@texto` pelo `@usuario ` escolhido e devolve o texto novo e a posição do cursor, logo
// depois do espaço.
export function applyMention(
  text: string,
  { start }: MentionQuery,
  caret: number,
  username: string,
): { text: string; caret: number } {
  const inserted = `@${username} `;
  const rest = text.slice(caret).replace(/^ /, "");
  return { text: text.slice(0, start) + inserted + rest, caret: start + inserted.length };
}

// Insere um `@` na posição do cursor (o botão `@` da caixa), com um espaço antes quando o caractere
// anterior não é espaço, para a lista abrir.
export function insertAt(text: string, caret: number): { text: string; caret: number } {
  const needsSpace = caret > 0 && !/\s/u.test(text[caret - 1]);
  const inserted = needsSpace ? " @" : "@";
  return { text: text.slice(0, caret) + inserted + text.slice(caret), caret: caret + inserted.length };
}
