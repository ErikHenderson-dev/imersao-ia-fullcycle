import { DomainError } from '../common/errors/domain.error';

// A Tarefa não existe ou não é de quem pede: nem Responsável, nem quem delegou (spec da F12,
// "Tarefa").
export class TaskNotFoundError extends DomainError {
  readonly code = 'task_not_found';

  constructor() {
    super('Tarefa não encontrada.');
  }
}
