import type { Theme } from '../people/profile-values';
import type { Presence, StatusPayload } from 'chat-events';
import { toStatusResponse } from '../people/status.response';
import { Person } from '../people/person.entity';

export interface PersonResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  time_zone: string | null;
  status: StatusPayload | null;
  // O papel de administrador (spec da F10, "Papel de administrador").
  is_admin: boolean;
  presence_choice: Presence;
  theme: Theme;
}

export function toPersonResponse(person: Person): PersonResponse {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    username: person.username,
    time_zone: person.timeZone,
    status: toStatusResponse(person),
    is_admin: person.isAdmin,
    presence_choice: person.presenceChoice,
    theme: person.theme,
  };
}
