import type { Mention } from "@/app/services/chat-api";
import { splitLinks } from "./message-links";

export type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "link"; href: string }
  | { kind: "mention"; text: string; mention: Mention };

// O tamanho máximo do @usuário, o mesmo da API (spec da F05, "Pessoas").
export const USERNAME_MAX_LENGTH = 30;

// O mesmo reconhecimento da API (spec da F06, "Menções, ao gravar"): `@` no começo ou depois de um
// caractere que não pode fazer parte de um @usuário.
const MENTION = new RegExp(
  String.raw`(?<![\p{L}\p{N}._@-])@([a-z0-9](?:[a-z0-9._-]{0,${USERNAME_MAX_LENGTH - 2}}[a-z0-9])?)(?![a-z0-9_-]|\.[a-z0-9])`,
  "giu",
);

// O corpo da Mensagem em texto, link e Menção (spec da F06, "Texto da Mensagem"). Um @usuário só é
// Menção quando está em `mentions`, que a API resolveu ao gravar; fora disso, é texto.
export function splitMessageBody(text: string, mentions: readonly Mention[]): MessageSegment[] {
  const byUsername = new Map(mentions.map((mention) => [mention.username, mention]));
  return splitLinks(text).flatMap((segment): MessageSegment[] =>
    segment.kind === "link" || byUsername.size === 0
      ? [segment]
      : splitMentions(segment.text, byUsername),
  );
}

function splitMentions(text: string, byUsername: Map<string, Mention>): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MENTION)) {
    const mention = byUsername.get(match[1].toLowerCase());
    if (!mention) continue;
    if (match.index > cursor) segments.push({ kind: "text", text: text.slice(cursor, match.index) });
    segments.push({ kind: "mention", text: match[0], mention });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}
