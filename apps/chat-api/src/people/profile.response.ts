import { Person } from './person.entity';

// O Perfil de uma Pessoa, como o workspace o vê (spec da F05, "Busca e Perfil").
export interface ProfileResponse {
  id: string;
  name: string;
  username: string;
  title: string | null;
  email: string;
  phone: string | null;
  time_zone: string | null;
}

export function toProfileResponse(person: Person): ProfileResponse {
  return {
    id: person.id,
    name: person.name,
    username: person.username,
    title: person.title,
    email: person.email,
    phone: person.phone,
    time_zone: person.timeZone,
  };
}
