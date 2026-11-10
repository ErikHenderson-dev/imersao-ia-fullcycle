"use client";

import { useEffect, useState } from "react";
import type { PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// Espera da busca de Pessoas (LLD, "Valores e configuração").
const SEARCH_DELAY_MS = 200;

export type PeopleSearchState =
  | { kind: "loading" }
  | { kind: "ok"; people: PersonEntry[] }
  | { kind: "failure" };

// A busca de Pessoas pelo BFF, depois da espera sem digitar: uma busca nova cancela a anterior,
// esperando ou em andamento, e só a resposta da última vale (spec da F04, "Passo 'Adicionar
// pessoas'"). Sem `notMemberOf`, a busca do "Nova conversa" (spec da F05).
export function usePeopleSearch(query: string, notMemberOf?: string): PeopleSearchState {
  const [search, setSearch] = useState<PeopleSearchState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams(
        notMemberOf ? { q: query, not_member_of: notMemberOf } : { q: query },
      );
      try {
        const response = await fetch(`/api/people?${params.toString()}`, {
          signal: controller.signal,
        });
        if (response.status === 401) return void redirectToExpiredSession();
        if (!response.ok) throw new Error("Falha na busca");
        const people = (await response.json()) as PersonEntry[];
        if (!controller.signal.aborted) setSearch({ kind: "ok", people });
      } catch {
        if (!controller.signal.aborted) setSearch({ kind: "failure" });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, notMemberOf]);

  return search;
}
