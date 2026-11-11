"use client";

import { useRef, useState } from "react";
import { useOpenProfileFromOverlay } from "@/app/components/profile/profile-panel-provider";
import { Dialog } from "@/app/components/ui/dialog";
import { SidebarAction } from "@/app/components/workspace-nav/sidebar-action";
import { SidebarSection } from "@/app/components/workspace-nav/sidebar-section";
import { agentsSectionView } from "@/app/utils/agents-section";
import { AgentAvatar } from "./agent-avatar";
import { AgentsDialog } from "./agents-dialog";
import { useAgents } from "./agents-provider";

type AgentsSectionProps = {
  personId: string;
  isAdmin: boolean;
};

// A seção Agentes da barra lateral, depois de "Mensagens diretas" (spec da F10, "Seção Agentes da
// barra lateral"): os conectados, cada um com o AgentAvatar e o nome, e a ação pelo papel. A linha e
// a ação abrem o diálogo "Agentes"; ao fechar, o foco volta a quem o abriu.
export function AgentsSection({ personId, isAdmin }: AgentsSectionProps) {
  const { agents } = useAgents();
  const view = agentsSectionView({ isAdmin, agents });
  const [isOpen, setIsOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const profile = useOpenProfileFromOverlay();

  function open(event: React.MouseEvent<HTMLElement>) {
    opener.current = event.currentTarget;
    setIsOpen(true);
  }

  return (
    <>
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
                    <AgentAvatar size="xs" />
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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && (
          <AgentsDialog
            personId={personId}
            isAdmin={isAdmin}
            onCloseAutoFocus={(event) => {
              profile.onCloseAutoFocus(event);
              if (event.defaultPrevented) return;
              event.preventDefault();
              opener.current?.focus();
            }}
            onPersonSelect={(selectedId) => {
              setIsOpen(false);
              profile.open(selectedId, opener.current);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
