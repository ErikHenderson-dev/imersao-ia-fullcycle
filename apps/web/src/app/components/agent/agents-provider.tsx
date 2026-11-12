"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useOpenProfileFromOverlay } from "@/app/components/profile/profile-panel-provider";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { Dialog } from "@/app/components/ui/dialog";
import type { Agent } from "@/app/services/agents-service";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { AgentsDialog } from "./agents-dialog";

// A chave do cache da lista de Agentes no cliente (spec da F10, "Lista de Agentes no cliente").
export const AGENTS_KEY = "/api/agents";

async function fetchAgents(url: string): Promise<Agent[]> {
  const response = await fetch(url);
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível carregar os agentes.");
  return (await response.json()) as Agent[];
}

type AgentsContextValue = {
  // A lista, ou null enquanto ela está indisponível (a leitura do layout falhou e nenhuma releitura
  // deu certo ainda).
  agents: Agent[] | null;
  // A última releitura falhou.
  error: unknown;
  isValidating: boolean;
  reload: () => Promise<unknown>;
  // Abre o diálogo "Agentes"; ao fechar, o foco volta a `opener`.
  openAgentsDialog: (opener: HTMLElement | null) => void;
};

const AgentsContext = createContext<AgentsContextValue | null>(null);

// O mesmo contexto, lido sem exigir o provider (a lista de menções também existe fora dele, nos
// testes de componente e telas sem Sessão).
export const AgentsContextForPicker = AgentsContext;

// A lista de Agentes do cliente, num cache do SWR com a lista lida pelo layout como ponto de
// partida. Ela se relê no agents.changed, a cada conexão e reconexão do socket (o evento perdido
// numa queda não volta), na abertura do diálogo, no "Tentar de novo" e depois de conectar e
// desconectar (spec da F10, "Lista de Agentes no cliente"). O diálogo "Agentes" mora aqui, para a
// seção da barra lateral e a Menção a um Agente o abrirem, com a gaveta aberta ou não.
export function AgentsProvider({
  initialAgents,
  personId,
  isAdmin,
  children,
}: {
  initialAgents: Agent[] | null;
  personId: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const { data, error, isValidating, mutate } = useSWR(AGENTS_KEY, fetchAgents, {
    fallbackData: initialAgents ?? undefined,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const reload = useCallback(() => mutate(), [mutate]);
  const { status, subscribe } = useRealtime();

  useEffect(() => subscribe({ onAgentsChanged: () => void mutate() }), [subscribe, mutate]);

  // Cada "connected" é uma conexão nova: a primeira ou a volta depois de uma queda.
  useEffect(() => {
    if (status === "connected") void mutate();
  }, [status, mutate]);

  const [isOpen, setIsOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const profile = useOpenProfileFromOverlay();
  const openAgentsDialog = useCallback((element: HTMLElement | null) => {
    opener.current = element;
    setIsOpen(true);
  }, []);

  const value = useMemo(
    () => ({ agents: data ?? null, error, isValidating, reload, openAgentsDialog }),
    [data, error, isValidating, reload, openAgentsDialog],
  );
  return (
    <AgentsContext value={value}>
      {children}
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
    </AgentsContext>
  );
}

export function useAgents(): AgentsContextValue {
  const value = useContext(AgentsContext);
  if (!value) throw new Error("useAgents fora do AgentsProvider");
  return value;
}

// Abre o diálogo "Agentes" de fora da barra lateral; nada fora do AgentsProvider.
export function useOpenAgentsDialog(): ((opener: HTMLElement | null) => void) | null {
  return useContext(AgentsContext)?.openAgentsDialog ?? null;
}
