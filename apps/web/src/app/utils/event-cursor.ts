// Cursores dos eventos do tempo real (spec da F03, "Eventos por Pessoa e reconexão"): "<época>:<id
// do stream>", com o id do stream "<ms>-<seq>".

function parseCursor(cursor: string): { epoch: string; ms: number; seq: number } | null {
  const match = /^(.+):(\d+)-(\d+)$/.exec(cursor);
  return match ? { epoch: match[1], ms: Number(match[2]), seq: Number(match[3]) } : null;
}

// Ordem de dois cursores da mesma época; de épocas diferentes, ou malformados, não se comparam
// (devolve 0).
export function compareCursors(a: string, b: string): number {
  const left = parseCursor(a);
  const right = parseCursor(b);
  if (!left || !right || left.epoch !== right.epoch) return 0;
  return left.ms - right.ms || left.seq - right.seq;
}

// O cursor a guardar depois de receber `next`: o maior da mesma época, ou o novo quando a época
// mudou.
export function laterCursor(current: string | null, next: string | null | undefined): string | null {
  if (!next) return current;
  if (!current) return next;
  const left = parseCursor(current);
  const right = parseCursor(next);
  if (!left || !right || left.epoch !== right.epoch) return next;
  return compareCursors(next, current) > 0 ? next : current;
}

// Os eventos guardados até o sync, prontos para aplicar: em ordem de cursor, sem repetir um
// cursor, e os sem cursor (Redis fora) no fim, na ordem de chegada. `cursorOf` lê o cursor de cada
// um.
export function orderForSync<T>(
  events: readonly T[],
  cursorOf: (event: T) => string | undefined,
): T[] {
  const seen = new Set<string>();
  const withCursor: T[] = [];
  const withoutCursor: T[] = [];
  for (const event of events) {
    const cursor = cursorOf(event);
    if (!cursor) {
      withoutCursor.push(event);
    } else if (!seen.has(cursor)) {
      seen.add(cursor);
      withCursor.push(event);
    }
  }
  withCursor.sort((a, b) => compareCursors(cursorOf(a)!, cursorOf(b)!));
  return [...withCursor, ...withoutCursor];
}
