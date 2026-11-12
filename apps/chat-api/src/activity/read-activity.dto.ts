import {
  IsUUID,
  Validate,
  ValidateIf,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

// Recusa o corpo com os dois ids, ou com nenhum.
@ValidatorConstraint({ name: 'exactlyOnePosition' })
class ExactlyOnePosition implements ValidatorConstraintInterface {
  validate(_: unknown, { object }: ValidationArguments): boolean {
    const dto = object as ReadActivityDto;
    return (
      (dto.message_id === undefined) !==
      (dto.task_notification_id === undefined)
    );
  }

  defaultMessage(): string {
    return 'Mande message_id ou task_notification_id, e só um deles.';
  }
}

// A marca de Atividade: a Notificação mais nova que a Pessoa viu (spec da F08, "Rotas"), uma
// Mensagem ou uma Notificação de Tarefa (spec da F12, "Atividade"), exatamente uma das duas.
export class ReadActivityDto {
  @Validate(ExactlyOnePosition)
  @ValidateIf((dto: ReadActivityDto) => dto.task_notification_id === undefined)
  @IsUUID()
  message_id?: string;

  @ValidateIf((dto: ReadActivityDto) => dto.task_notification_id !== undefined)
  @IsUUID()
  task_notification_id?: string;
}
