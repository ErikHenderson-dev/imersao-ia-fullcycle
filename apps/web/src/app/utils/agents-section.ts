import type { SidebarActionVariant } from "@/app/components/workspace-nav/sidebar-action";
import type { Agent } from "@/app/services/agents-service";

export type AgentsSectionView = {
  // Os Agentes conectados, uma linha cada.
  rows: Agent[];
  action: SidebarActionVariant;
  // O CountBadge da ação: os desconectados, só em `connect`.
  count: number;
};

// A seção Agentes da barra lateral pelo papel e pela lista (spec da F10, "Seção Agentes da barra
// lateral"). `agents` nulo é a lista indisponível: nenhuma linha, e a ação que não depende dela.
export function agentsSectionView({
  isAdmin,
  agents,
}: {
  isAdmin: boolean;
  agents: readonly Agent[] | null;
}): AgentsSectionView {
  if (agents === null) return { rows: [], action: isAdmin ? "manage" : "view", count: 0 };
  const rows = agents.filter((agent) => agent.connected);
  return { rows, action: "view", count: 0 };
}
