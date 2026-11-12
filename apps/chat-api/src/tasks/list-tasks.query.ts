import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import {
  MESSAGE_PAGE_MAX_SIZE,
  MESSAGE_PAGE_SIZE,
} from '../messages/message-values';

export type TaskRole = 'assigned' | 'delegated';
const ROLES: TaskRole[] = ['assigned', 'delegated'];

// O cursor é `<status>.<id>` da última Tarefa da página anterior.
export const TASK_CURSOR =
  /^(open|done)\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// As Tarefas recebidas ou delegadas (spec da F12, "Concluir, reabrir e listar"), com a página do
// histórico, como a Atividade.
export class ListTasksQuery {
  @IsIn(ROLES)
  role!: TaskRole;

  @IsOptional()
  @Matches(TASK_CURSOR)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGE_PAGE_MAX_SIZE)
  limit: number = MESSAGE_PAGE_SIZE;
}
