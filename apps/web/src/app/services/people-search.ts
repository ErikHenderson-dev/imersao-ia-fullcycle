import type { PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// Busca de Pessoas pela rota do BFF, no cliente (spec da F04 e da F05, "BFF"). Sem `notMemberOf`,
// a busca do "Nova conversa". O 401 leva a "Entrar".
export async function fetchPeople(
  query: string,
  notMemberOf: string | undefined,
  signal: AbortSignal,
): Promise<PersonEntry[]> {
  const params = new URLSearchParams(
    notMemberOf === undefined ? { q: query } : { q: query, not_member_of: notMemberOf },
  );
  const response = await fetch(`/api/people?${params.toString()}`, { signal });
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Falha na busca");
  return (await response.json()) as PersonEntry[];
}
