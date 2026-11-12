import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { AgentsService } from './agents.service';

// Agentes na API do chat (spec da F10, "Evento agents.changed").
@Controller('agents')
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  // Um administrador avisa o workspace que o registro mudou, depois de conectar ou desconectar.
  @Post('changed')
  @HttpCode(204)
  announceChange(@CurrentPerson() person: Person): void {
    this.agents.announceChange(person);
  }
}
