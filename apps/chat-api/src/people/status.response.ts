import type { StatusPayload } from 'chat-events';

// O Status como o workspace o vê (spec da F09, "Rotas"): o emoji e a mensagem, ou nulo sem Status.
export function toStatusResponse(person: {
  statusEmoji: string | null;
  statusText: string | null;
}): StatusPayload | null {
  if (person.statusEmoji === null) return null;
  return {
    emoji: person.statusEmoji as StatusPayload['emoji'],
    text: person.statusText,
  };
}
