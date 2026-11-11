import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { AgentRequestsService } from './agent-requests.service';
import { CloseAgentRequestDto } from './close-agent-request.dto';

@Controller('agent-requests')
@UseGuards(AuthGuard)
export class AgentRequestsController {
  constructor(private readonly requests: AgentRequestsService) {}

  // O BFF encerra o Pedido de quem pediu quando o Serviço de agentes não o aceitou.
  @Post(':id/close')
  @HttpCode(204)
  async close(
    @CurrentPerson() person: Person,
    @Param('id') id: string,
    @Body() body: CloseAgentRequestDto,
  ): Promise<void> {
    await this.requests.close(person.id, id, body.status);
  }
}
