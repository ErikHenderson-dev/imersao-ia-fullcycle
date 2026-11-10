import { Person } from '../people/person.entity';

export interface PersonResponse {
  id: string;
  name: string;
  email: string;
  username: string;
}

export function toPersonResponse(person: Person): PersonResponse {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    username: person.username,
  };
}
