import type { Agent } from "@/app/services/agents-service";

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
