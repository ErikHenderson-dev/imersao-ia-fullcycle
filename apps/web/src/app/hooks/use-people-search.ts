"use client";

import { useEffect, useState } from "react";
import type { PersonEntry } from "@/app/services/chat-api";
import { fetchPeople, type PeopleFilter } from "@/app/services/people-search";

// Espera da busca de Pessoas (LLD, "Valores e configuração").
const SEARCH_DELAY_MS = 200;

// O resultado da última busca que respondeu, com o texto dela: enquanto a do texto atual não
// responde, a lista na tela é a da anterior.
export type PeopleSearchState =
  | { kind: "loading" }
  | { kind: "ok"; people: PersonEntry[]; query: string }
  | { kind: "failure" };

// A busca de Pessoas, depois da espera sem digitar: uma busca nova cancela a anterior, esperando ou
// em andamento, e só a resposta da última vale (spec da F04, "Passo 'Adicionar pessoas'"). Sem
// filtro, a busca do "Nova conversa" (spec da F05); com `memberOf`, a lista de menções (F06).
// Com `enabled` falso, nada é buscado (a lista de menções fechada).
export function usePeopleSearch(
  query: string,
  { notMemberOf, memberOf }: PeopleFilter = {},
  enabled = true,
): PeopleSearchState {
  const [search, setSearch] = useState<PeopleSearchState>({ kind: "loading" });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const people = await fetchPeople(query, { notMemberOf, memberOf }, controller.signal);
        if (!controller.signal.aborted) setSearch({ kind: "ok", people, query });
      } catch {
        if (!controller.signal.aborted) setSearch({ kind: "failure" });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, notMemberOf, memberOf, enabled]);

  return search;
}
