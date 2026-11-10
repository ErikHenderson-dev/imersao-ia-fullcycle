import type { PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// O filtro da busca pela Conversa: fora dos Membros dela (adicionar ao Canal privado, F04), só entre
// eles (lista de menções, F06) ou nenhum ("Nova conversa", F05).
export type PeopleFilter = { notMemberOf?: string; memberOf?: string };

// Busca de Pessoas pela rota do BFF, no cliente (spec da F04 e da F05, "BFF"). O 401 leva a
// "Entrar".
export async function fetchPeople(
  query: string,
  { notMemberOf, memberOf }: PeopleFilter,
  signal: AbortSignal,
): Promise<PersonEntry[]> {
  const params = new URLSearchParams({ q: query });
  if (notMemberOf !== undefined) params.set("not_member_of", notMemberOf);
  if (memberOf !== undefined) params.set("member_of", memberOf);
  const response = await fetch(`/api/people?${params.toString()}`, { signal });
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Falha na busca");
  return (await response.json()) as PersonEntry[];
}
