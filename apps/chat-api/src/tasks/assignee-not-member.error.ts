import { DomainError } from '../common/errors/domain.error';

// O Responsável pedido não é uma Pessoa Membro da Conversa do Pedido (spec da F12, "Ação `task`").
export class AssigneeNotMemberError extends DomainError {
  readonly code = 'assignee_not_member';

  constructor() {
    super('O Responsável precisa ser Membro da Conversa do Pedido.');
  }
}
