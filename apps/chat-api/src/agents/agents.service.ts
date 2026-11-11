import { Injectable } from '@nestjs/common';
import { Person } from '../people/person.entity';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { NotAdminError } from './not-admin.error';

// O aviso de que o registro de Agentes mudou (spec da F10, "Evento agents.changed"). O registro mora
// no Serviço de agentes; a API do chat só avisa o workspace.
@Injectable()
export class AgentsService {
  constructor(private readonly realtime: RealtimePublisher) {}

  // O papel é o da Pessoa que o guard leu do banco nesta requisição: quem o perdeu é recusado na
  // próxima ação, com a mesma Sessão.
  announceChange(person: Person): void {
    if (!person.isAdmin) throw new NotAdminError();
    this.realtime.agentsChanged();
  }
}
