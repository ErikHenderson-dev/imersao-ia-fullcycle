// As contagens dos Recortes, na ordem dos `since` pedidos, cada `since` como chegou.
export interface BotCountsResponse {
  counts: { since: string; count: number }[];
  total: number;
}

export function toBotCountsResponse(
  sinces: string[],
  { counts, total }: { counts: number[]; total: number },
): BotCountsResponse {
  return {
    counts: sinces.map((since, index) => ({ since, count: counts[index] })),
    total,
  };
}
