import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  Matches,
} from 'class-validator';
import { WITH_OFFSET } from './bot-messages.query';
import { MESSAGE_COUNTS_MAX_SINCES } from './bot-values';

// As contagens que o bot pede: um `since` por Recorte, repetido na query, e o mesmo `until`
// exclusivo da leitura (spec da F11, "Rotas do bot e credencial"). Instantes com fuso, como na
// leitura.
export class BotCountsQuery {
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || Array.isArray(value) ? value : [value],
  )
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MESSAGE_COUNTS_MAX_SINCES)
  @IsISO8601({ strict: true }, { each: true })
  @Matches(WITH_OFFSET, { each: true })
  since?: string[];

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET)
  until?: string;
}
