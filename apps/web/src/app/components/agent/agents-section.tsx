"use client";

import { SidebarAction } from "@/app/components/workspace-nav/sidebar-action";
import { SidebarSection } from "@/app/components/workspace-nav/sidebar-section";
import { agentsSectionView } from "@/app/utils/agents-section";
import { AgentAvatar } from "./agent-avatar";
import { useAgents } from "./agents-provider";

// A seção Agentes da barra lateral, depois de "Mensagens diretas" (spec da F10, "Seção Agentes da
// barra lateral"): os conectados, cada um com o AgentAvatar e o nome, e a ação pelo papel. A linha e
// a ação abrem o diálogo "Agentes"; ao fechar, o foco volta a quem o abriu.
export function AgentsSection({ isAdmin }: { isAdmin: boolean }) {
  const { agents, openAgentsDialog } = useAgents();
  const view = agentsSectionView({ isAdmin, agents });
  const open = (event: React.MouseEvent<HTMLElement>) => openAgentsDialog(event.currentTarget);

  return (
    <SidebarSection title="Agentes">
      {(isExpanded) =>
        isExpanded && (
          <>
            {view.rows.map((agent) => (
              <li key={agent.slug}>
                <button
                  type="button"
                  onClick={open}
                  className="flex h-11 w-full items-center gap-2 rounded-item px-2 text-body text-sidebar-fg hover:bg-sidebar-hover md:h-7"
                >
                  <AgentAvatar size="xs" surface="field" />
                  <span className="truncate">{agent.name}</span>
                </button>
              </li>
            ))}
            <li>
              <SidebarAction
                variant={view.action}
                count={view.count}
                countLabel={`${view.count} ${view.count === 1 ? "desconectado" : "desconectados"}`}
                onClick={open}
              />
            </li>
          </>
        )
      }
    </SidebarSection>
  );
}
