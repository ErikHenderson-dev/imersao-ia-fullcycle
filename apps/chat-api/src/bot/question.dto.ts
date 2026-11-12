import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { NoNullCharacter } from '../common/validation/no-null-character';
import { ReplyDto } from './reply.dto';
import { QUICK_REPLIES_MAX, QUICK_REPLY_MAX_LENGTH } from './bot-values';

// A pergunta do bot: o texto, com as regras da Mensagem, e os rótulos das Respostas prontas, que o
// clique envia como o texto de uma Mensagem (spec da F11, "Rotas do bot e credencial"). A lista
// pode vir vazia: a pergunta sem botões da delegação (spec da F12, "O Agente `assistente`").
export class QuestionDto extends ReplyDto {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((label: unknown) =>
          typeof label === 'string' ? label.trim() : label,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(QUICK_REPLIES_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(QUICK_REPLY_MAX_LENGTH, { each: true })
  @NoNullCharacter({ each: true })
  quick_replies!: string[];
}
