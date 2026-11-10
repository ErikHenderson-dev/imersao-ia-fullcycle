import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { MaxCodePoints } from '../common/validation/max-code-points';
import { NoNullCharacter } from '../common/validation/no-null-character';
import { MESSAGE_MAX_LENGTH } from './message-values';

// O texto da Mensagem, no envio e na edição (spec da F02, "Mensagens"; spec da F06, "Editar"). Os
// espaços e as quebras de linha das pontas saem antes de validar.
export class EditMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(MESSAGE_MAX_LENGTH)
  @NoNullCharacter()
  body!: string;
}
