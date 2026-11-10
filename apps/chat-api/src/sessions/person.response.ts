import type { StatusPayload } from 'chat-events';
import { toStatusResponse } from '../people/status.response';
import { Person } from '../people/person.entity';

export interface PersonResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  time_zone: string | null;
  status: StatusPayload | null;
  presence_choice: 'available' | 'away';
}

export function toPersonResponse(person: Person): PersonResponse {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    username: person.username,
    time_zone: person.timeZone,
    status: toStatusResponse(person),
    presence_choice: person.presenceChoice,
  };
}
