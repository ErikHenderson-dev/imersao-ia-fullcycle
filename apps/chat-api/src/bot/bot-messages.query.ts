import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// O instante tem de trazer o fuso (`Z` ou `±hh:mm`): sem ele, o `Date` leria a hora no fuso do
// servidor, e a API só recebe UTC (spec da F11, "Rotas do bot e credencial").
export const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

// O Recorte que o bot lê: instantes UTC, `since` inclusivo e `until` exclusivo, e o @usuário de
// uma Pessoa, sem o `@`.
export class BotMessagesQuery {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET)
  since?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET)
  until?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  author_username?: string;
}
