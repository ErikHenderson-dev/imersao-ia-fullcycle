import type { StatusPayload } from 'chat-events';
import { compareNames } from '../conversations/name-order';
import { toStatusResponse } from './status.response';

// Uma Pessoa nas listas por nome (Membros, busca), sem o e-mail: o @usuário, o cargo e o Status
// entram na linha dela (spec da F05, "Pessoa nas listas"; spec da F09, "Rotas").
export interface PersonSummary {
  id: string;
  name: string;
  username: string;
  title: string | null;
  status: StatusPayload | null;
}

// O que as listas leem da Pessoa.
export interface SummarySource {
  id: string;
  name: string;
  username: string;
  title: string | null;
  statusEmoji: string | null;
  statusText: string | null;
}

// As Pessoas na ordem alfabética da aplicação ("name-order.ts").
export function sortedSummaries(people: SummarySource[]): PersonSummary[] {
  return people
    .map((person) => ({
      id: person.id,
      name: person.name,
      username: person.username,
      title: person.title,
      status: toStatusResponse(person),
    }))
    .sort((a, b) => compareNames(a.name, b.name));
}
