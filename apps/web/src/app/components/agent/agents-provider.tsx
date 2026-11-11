"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import useSWR from "swr";
import type { Agent } from "@/app/services/agents-service";
import { redirectToExpiredSession } from "@/app/utils/return-path";

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
};

const AgentsContext = createContext<AgentsContextValue | null>(null);

// A lista de Agentes do cliente, num cache do SWR com a lista lida pelo layout como ponto de
// partida. Ela não se relê sozinha: quem relê é a abertura do diálogo, o "Tentar de novo" e, nas
// próximas tarefas, o agents.changed, a conexão do socket e as ações de conectar e desconectar.
export function AgentsProvider({
  initialAgents,
  children,
}: {
  initialAgents: Agent[] | null;
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
  const value = useMemo(
    () => ({ agents: data ?? null, error, isValidating, reload }),
    [data, error, isValidating, reload],
  );
  return <AgentsContext value={value}>{children}</AgentsContext>;
}

export function useAgents(): AgentsContextValue {
  const value = useContext(AgentsContext);
  if (!value) throw new Error("useAgents fora do AgentsProvider");
  return value;
}
