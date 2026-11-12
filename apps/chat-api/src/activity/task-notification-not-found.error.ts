import { DomainError } from '../common/errors/domain.error';

// A Notificação de Tarefa não existe ou não é de quem pede (spec da F12, "Atividade").
export class TaskNotificationNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor() {
    super('Notificação não encontrada.');
  }
}
