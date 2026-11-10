import { Person } from '../people/person.entity';

export interface PersonResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  time_zone: string | null;
}

export function toPersonResponse(person: Person): PersonResponse {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    username: person.username,
    time_zone: person.timeZone,
  };
}
