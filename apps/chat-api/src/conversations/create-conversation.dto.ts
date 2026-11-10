import {
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import type { ConversationKind } from './conversation.entity';

const KINDS: ConversationKind[] = [
  'public_channel',
  'private_channel',
  'direct',
];

const isDirect = (body: CreateConversationDto) => body.kind === 'direct';
const isChannel = (body: CreateConversationDto) => body.kind !== 'direct';

// Criação de Canal pelo produto (spec da F04, "Rotas") ou abertura da Conversa direta (spec da F05,
// "Rotas"): a regra do nome e a do Tópico ficam no service ("channel-name.ts"), a mesma do comando
// de canais. Cada tipo recusa os campos do outro.
export class CreateConversationDto {
  @IsIn(KINDS)
  kind!: ConversationKind;

  @ValidateIf(isChannel)
  @IsString()
  name?: string;

  @ValidateIf(isChannel)
  @IsOptional()
  @IsString()
  topic?: string;

  // Identificador gerado no cliente (LLD, "Concorrência e idempotência").
  @ValidateIf(isChannel)
  @IsUUID()
  client_id?: string;

  // A outra Pessoa da Conversa direta.
  @ValidateIf(isDirect)
  @IsUUID()
  person_id?: string;

  // Os campos que o tipo não aceita.
  @ValidateIf(isDirect)
  @IsEmpty()
  get channelFields(): unknown {
    return this.name ?? this.topic ?? this.client_id;
  }

  @ValidateIf(isChannel)
  @IsEmpty()
  get directFields(): unknown {
    return this.person_id;
  }
}
