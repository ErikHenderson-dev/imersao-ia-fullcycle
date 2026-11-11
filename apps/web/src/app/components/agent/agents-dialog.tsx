"use client";

import { Bot } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { connectAgent } from "@/app/actions/agent-connection";
import { Button } from "@/app/components/ui/button";
import { DialogBody, DialogContent } from "@/app/components/ui/dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Spinner } from "@/app/components/ui/spinner";
import { PersonRow } from "@/app/components/user/person-row";
import type { Agent } from "@/app/services/agents-service";
import type { PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { AgentAvatar } from "./agent-avatar";
import { useAgents } from "./agents-provider";

const ADMINS_KEY = "/api/people?admin=true";

const ADMIN_DESCRIPTION = "Conecte um agente ao workspace e mencione-o com @ em qualquer conversa.";

const MEMBER_DESCRIPTION =
  "Mencione um agente conectado com @ em qualquer conversa. Só administradores conectam ou desconectam agentes.";

async function fetchAdmins(url: string): Promise<PersonEntry[]> {
  const response = await fetch(url);
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível carregar os administradores.");
  return (await response.json()) as PersonEntry[];
}

type AgentsDialogProps = {
  // A Pessoa da Sessão: "(você)" na lista de administradores.
  personId: string;
  // O administrador conecta e desconecta; quem não administra vê o estado e os administradores.
  isAdmin: boolean;
  onPersonSelect: (personId: string) => void;
  onCloseAutoFocus: (event: Event) => void;
};

// O diálogo "Agentes" (spec da F10, "Diálogo Agentes"), montado a cada abertura: relê a lista ao
// abrir, mostrando o cache enquanto lê. Sem dados, Carregando; na falha da releitura, Erro com
// "Tentar de novo"; com o catálogo vazio, Vazio. Quem não administra vê cada Agente com o estado,
// sem botões, e a lista de administradores, que abre o perfil.
export function AgentsDialog({
  personId,
  isAdmin,
  onPersonSelect,
  onCloseAutoFocus,
}: AgentsDialogProps) {
  const { agents, error, reload } = useAgents();
  const [isRevalidated, setIsRevalidated] = useState(false);

  const finishReload = useCallback(
    () =>
      reload()
        .catch(() => undefined)
        .finally(() => setIsRevalidated(true)),
    [reload],
  );

  // A releitura da abertura: o conteúdo monta a cada abertura, com isRevalidated falso.
  useEffect(() => {
    void finishReload();
  }, [finishReload]);

  function retry() {
    setIsRevalidated(false);
    void finishReload();
  }

  return (
    <DialogContent
      title="Agentes"
      description={isAdmin ? ADMIN_DESCRIPTION : MEMBER_DESCRIPTION}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogBody>
        {isRevalidated && error ? (
          <EmptyState
            title="Não foi possível carregar os agentes"
            description="Verifique sua conexão e tente de novo."
            action={
              <Button type="button" onClick={retry}>
                Tentar de novo
              </Button>
            }
          />
        ) : !agents ? (
          <div role="status" aria-label="Carregando os agentes" className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <span key={index} className="h-14 motion-safe:animate-pulse rounded-item bg-surface-inset" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Nenhum agente disponível"
            description="Quando o administrador publicar agentes, eles aparecem aqui para conectar."
          />
        ) : isAdmin ? (
          <AdminView agents={agents} onConnected={finishReload} />
        ) : (
          <MemberView agents={agents} personId={personId} onPersonSelect={onPersonSelect} />
        )}
      </DialogBody>
    </DialogContent>
  );
}

// A visão do administrador: cada Agente com "Conectar" ou "Desconectar". Conectar passa a linha a
// "Conectando", sem aceitar outro clique, e relê a lista no sucesso.
function AdminView({ agents, onConnected }: { agents: Agent[]; onConnected: () => Promise<unknown> }) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const hasConnected = agents.some((agent) => agent.connected);

  async function connect(agent: Agent) {
    setConnecting(agent.slug);
    try {
      const result = await connectAgent(agent.slug);
      if (result.kind === "ok") await onConnected();
      else if (result.kind === "unauthenticated") redirectToExpiredSession();
      else if (result.kind === "forbidden") toast.error("Só administradores conectam agentes");
      else toast.error("Não foi possível conectar o agente");
    } catch {
      toast.error("Não foi possível conectar o agente");
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!hasConnected && (
        <p className="rounded-item bg-surface-inset px-3 py-2 text-small text-fg">
          Nenhum agente conectado ainda. Conecte um para todo mundo poder mencioná-lo nas conversas.
        </p>
      )}
      <ul aria-label="Agentes" className="flex flex-col">
        {agents.map((agent) => (
          <li key={agent.slug}>
            <AgentRow agent={agent}>
              {agent.connected ? (
                <Button type="button" variant="secondary" size="sm" className="shrink-0">
                  Desconectar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  loading={connecting === agent.slug}
                  disabled={connecting !== null}
                  onClick={() => void connect(agent)}
                >
                  Conectar
                </Button>
              )}
            </AgentRow>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemberView({
  agents,
  personId,
  onPersonSelect,
}: {
  agents: Agent[];
  personId: string;
  onPersonSelect: (personId: string) => void;
}) {
  const hasConnected = agents.some((agent) => agent.connected);
  return (
    <div className="flex flex-col gap-2">
      {!hasConnected && (
        <p className="rounded-item bg-surface-inset px-3 py-2 text-small text-fg">
          Nenhum agente conectado ainda. Peça a quem administra o workspace para conectar.
        </p>
      )}
      <ul aria-label="Agentes" className="flex flex-col">
        {agents.map((agent) => (
          <li key={agent.slug}>
            <AgentRow agent={agent}>
              <span className="shrink-0 text-small text-fg-muted">
                {agent.connected ? "Conectado" : "Não conectado"}
              </span>
            </AgentRow>
          </li>
        ))}
      </ul>
      <Admins personId={personId} onPersonSelect={onPersonSelect} />
    </div>
  );
}

// AgentRow (Figma, 18:1362): o avatar, o nome com o @usuário e a descrição, e, no fim, o estado ou
// a ação.
export function AgentRow({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <AgentAvatar size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-body">
          <span className="font-bold text-fg">{agent.name}</span>{" "}
          <span className="text-fg-muted">@{agent.username}</span>
        </p>
        <p className="text-small text-fg-muted">{agent.description}</p>
      </div>
      {children}
    </div>
  );
}

function Admins({
  personId,
  onPersonSelect,
}: {
  personId: string;
  onPersonSelect: (personId: string) => void;
}) {
  // Lida a cada abertura, sem a janela de deduplicação do SWR: duas aberturas seguidas leem de novo.
  const { data: admins, error, mutate } = useSWR(ADMINS_KEY, fetchAdmins, {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return (
    <section aria-labelledby="agents-admins-title" className="flex flex-col gap-1">
      <h3 id="agents-admins-title" className="text-small font-bold text-fg">
        Administradores
      </h3>
      {admins?.length === 0 ? (
        <p className="text-small text-fg-muted">
          Ainda não há administrador no workspace. Fale com quem opera a instalação para conectar um
          agente.
        </p>
      ) : (
        <p className="text-small text-fg-muted">Para conectar um agente, peça a um administrador.</p>
      )}
      {!admins && !error && (
        <p role="status" className="flex items-center gap-2 p-2 text-small text-fg-muted">
          <Spinner />
          Carregando os administradores…
        </p>
      )}
      {error && !admins && (
        <div className="flex flex-col items-start gap-2 p-2">
          <p role="alert" className="text-small text-danger-fg">
            Não foi possível carregar os administradores.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void mutate()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {admins && admins.length > 0 && (
        <ul aria-label="Administradores" className="flex flex-col">
          {admins.map((admin) => (
            <li key={admin.id} className="flex">
              <button
                type="button"
                onClick={() => onPersonSelect(admin.id)}
                className="flex flex-1 items-center rounded-item p-2 text-left hover:bg-surface-subtle"
              >
                <PersonRow person={admin} isSelf={admin.id === personId} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
