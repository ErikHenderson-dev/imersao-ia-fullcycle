import { IsIn } from 'class-validator';
import {
  CLOSED_STATUSES,
  type AgentRequestClosedStatus,
} from './agent-request.entity';

// Como o BFF encerra o Pedido que o Serviço de agentes não aceitou (spec da F11, "Pedido e ações
// de bot").
export class CloseAgentRequestDto {
  @IsIn(CLOSED_STATUSES)
  status!: AgentRequestClosedStatus;
}
