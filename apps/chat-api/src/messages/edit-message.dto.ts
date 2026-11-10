import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { MaxCodePoints } from '../common/validation/max-code-points';
import { NoNullCharacter } from '../common/validation/no-null-character';
import { MESSAGE_MAX_LENGTH } from './message-values';

// O texto novo da Mensagem, com as mesmas regras do envio (spec da F06, "Editar").
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
