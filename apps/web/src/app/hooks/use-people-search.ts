"use client";

import { useEffect, useState } from "react";
import type { PersonEntry } from "@/app/services/chat-api";
import { fetchPeople } from "@/app/services/people-search";

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
// `notMemberOf`, a busca do "Nova conversa" (spec da F05).
export function usePeopleSearch(query: string, notMemberOf?: string): PeopleSearchState {
  const [search, setSearch] = useState<PeopleSearchState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const people = await fetchPeople(query, notMemberOf, controller.signal);
        if (!controller.signal.aborted) setSearch({ kind: "ok", people, query });
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
