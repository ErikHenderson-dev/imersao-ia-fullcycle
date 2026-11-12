import { DomainError } from '../common/errors/domain.error';

// Só o Responsável conclui e reabre a Tarefa (spec da F12, "Tarefa").
export class TaskNotAssigneeError extends DomainError {
  readonly code = 'task_not_assignee';

  constructor() {
    super('Só o Responsável conclui e reabre a Tarefa.');
  }
}
