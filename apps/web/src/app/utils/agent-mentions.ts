import type { Agent } from "@/app/services/agents-service";
import { splitMessageBody } from "./message-segments";

function normalized(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Os Agentes do autocompletar de Menção (spec da F10, "Menção a um Agente"): só os conectados cujo
// nome ou @usuário começa pelo que se digita, sem diferenciar maiúsculas e acentos, na ordem da
// lista. Com a lista indisponível, nenhum.
export function agentMentionOptions(agents: readonly Agent[] | null, query: string): Agent[] {
  if (!agents) return [];
  const typed = normalized(query.trim());
  return agents.filter(
    (agent) =>
      agent.connected &&
      (normalized(agent.name).startsWith(typed) || agent.username.startsWith(typed)),
  );
}

// O texto só pode mencionar um Agente se tiver `@`: sem ele, o BFF nem consulta o registro (spec da
// F11, "Disparo pelo BFF").
export function needsAgentRegistry(text: string): boolean {
  return text.includes("@");
}

// O @usuário do primeiro Agente conectado mencionado no texto, que o BFF manda como agent_username
// (spec da F11, "Disparo pelo BFF"), com a mesma regra do destaque no cliente (F10): `@` no limite
// de palavra e fora de link. Com o registro fora, nenhum, e a Menção fica como texto comum.
export function mentionedAgentUsername(text: string, agents: readonly Agent[] | null): string | null {
  if (!agents) return null;
  const connected = agents.filter((agent) => agent.connected).map((agent) => agent.username);
  const segment = splitMessageBody(text, [], connected).find((part) => part.kind === "agent");
  return segment?.kind === "agent" ? segment.username : null;
}
