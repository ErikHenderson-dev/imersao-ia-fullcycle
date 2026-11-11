"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
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
// partida. Ela se relê no agents.changed, a cada conexão e reconexão do socket (o evento perdido
// numa queda não volta), na abertura do diálogo, no "Tentar de novo" e depois de conectar e
// desconectar (spec da F10, "Lista de Agentes no cliente").
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
  const { status, subscribe } = useRealtime();

  useEffect(() => subscribe({ onAgentsChanged: () => void mutate() }), [subscribe, mutate]);

  // Cada "connected" é uma conexão nova: a primeira ou a volta depois de uma queda.
  useEffect(() => {
    if (status === "connected") void mutate();
  }, [status, mutate]);
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
