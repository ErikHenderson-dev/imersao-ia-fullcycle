import { compareNames } from '../conversations/name-order';

// Uma Pessoa nas listas por nome (Membros, busca), sem o e-mail: o @usuário e o cargo entram na
// linha dela (spec da F05, "Pessoa nas listas").
export interface PersonSummary {
  id: string;
  name: string;
  username: string;
  title: string | null;
}

// As Pessoas na ordem alfabética da aplicação ("name-order.ts").
export function sortedSummaries(people: PersonSummary[]): PersonSummary[] {
  return people
    .map(({ id, name, username, title }) => ({ id, name, username, title }))
    .sort((a, b) => compareNames(a.name, b.name));
}
