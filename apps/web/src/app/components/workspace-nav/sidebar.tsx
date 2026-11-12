import { Suspense } from "react";
import { AgentsSection } from "@/app/components/agent/agents-section";
import { listConversations } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { ConversationList } from "./conversation-list";
import { SidebarError } from "./sidebar-error";
import { SidebarSkeleton } from "./sidebar-skeleton";

// Lista de Conversas: "Canais", com "Adicionar canal" no fim (F04), e "Mensagens diretas" (F05),
// lidas no servidor e mantidas no cliente pelo tempo real (ConversationList), e a seção Agentes
// (F10). Abaixo de md ela fica na gaveta, com o Rail (NavigationDrawer).
export function Sidebar({ personId, isAdmin }: { personId: string; isAdmin: boolean }) {
  return (
    <aside
      aria-label="Barra lateral"
      className="flex w-sidebar shrink-0 flex-col bg-sidebar"
    >
      <div className="flex h-header items-center justify-between border-b border-sidebar-border pl-4 pr-2">
        <p className="text-title font-black text-sidebar-fg-strong">Full Cycle</p>
      </div>
      <nav aria-label="Conversas" className="flex flex-col overflow-y-auto py-3">
        <Suspense fallback={<SidebarSkeleton />}>
          <Channels personId={personId} />
        </Suspense>
        <AgentsSection isAdmin={isAdmin} />
      </nav>
    </aside>
  );
}

async function Channels({ personId }: { personId: string }) {
  const token = await readSessionToken();
  const result = token ? await listConversations(token) : null;
  // Sem Sessão, o layout já leva a Pessoa para "Entrar"; aqui a lista só fica vazia.
  if (result?.kind === "failure") return <SidebarError />;
  const conversations = result?.kind === "ok" ? result.conversations : [];
  return <ConversationList initialConversations={conversations} personId={personId} />;
}
