import type { Mention } from "@/app/services/chat-api";
import { splitLinks } from "./message-links";

export type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "link"; href: string }
  | { kind: "mention"; text: string; mention: Mention }
  // A Menção a um Agente conectado, reconhecida só no cliente (spec da F10, "Menção a um Agente").
  | { kind: "agent"; text: string; username: string };

// O tamanho máximo do @usuário, o mesmo da API (spec da F05, "Pessoas").
export const USERNAME_MAX_LENGTH = 30;

// O mesmo reconhecimento da API (spec da F06, "Menções, ao gravar"): `@` no começo ou depois de um
// caractere que não pode fazer parte de um @usuário.
const MENTION = new RegExp(
  String.raw`(?<![\p{L}\p{N}._@-])@([a-z0-9](?:[a-z0-9._-]{0,${USERNAME_MAX_LENGTH - 2}}[a-z0-9])?)(?![a-z0-9_-]|\.[a-z0-9])`,
  "giu",
);

// O corpo da Mensagem em texto, link e Menção (spec da F06, "Texto da Mensagem"). Um @usuário só é
// Menção quando está em `mentions`, que a API resolveu ao gravar, ou é o de um Agente conectado de
// `agentUsernames` (spec da F10); fora disso, é texto. A Pessoa ganha do Agente com o mesmo
// @usuário.
export function splitMessageBody(
  text: string,
  mentions: readonly Mention[],
  agentUsernames: readonly string[] = [],
): MessageSegment[] {
  const byUsername = new Map(mentions.map((mention) => [mention.username, mention]));
  const agents = new Set(agentUsernames);
  return splitLinks(text).flatMap((segment): MessageSegment[] =>
    segment.kind === "link" || (byUsername.size === 0 && agents.size === 0)
      ? [segment]
      : splitMentions(segment.text, byUsername, agents),
  );
}

function splitMentions(
  text: string,
  byUsername: Map<string, Mention>,
  agents: Set<string>,
): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MENTION)) {
    const username = match[1].toLowerCase();
    const mention = byUsername.get(username);
    if (!mention && !agents.has(username)) continue;
    if (match.index > cursor) segments.push({ kind: "text", text: text.slice(cursor, match.index) });
    segments.push(
      mention
        ? { kind: "mention", text: match[0], mention }
        : { kind: "agent", text: match[0], username },
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}
