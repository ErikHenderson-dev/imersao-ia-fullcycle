import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MaxCodePoints } from '../common/validation/max-code-points';
import { NoNullCharacter } from '../common/validation/no-null-character';
import { TASK_TITLE_MAX_LENGTH } from '../tasks/task-values';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// A delegação pelo bot: o @usuário do Responsável, sem a arroba, e o título da Tarefa (spec da F12,
// "Ação `task`").
export class TaskDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[^@]/, { message: 'assignee_username vem sem @' })
  @NoNullCharacter()
  assignee_username!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(TASK_TITLE_MAX_LENGTH)
  @NoNullCharacter()
  title!: string;
}
