import { DomainError } from '../common/errors/domain.error';

// O Responsável pedido é um bot, e uma Tarefa só vai a uma Pessoa (spec da F12, "Ação `task`").
export class AssigneeIsBotError extends DomainError {
  readonly code = 'assignee_is_bot';

  constructor() {
    super('Uma Tarefa não pode ser delegada a um Agente.');
  }
}
