import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

// O Recorte que o bot lê (spec da F11, "Rotas do bot e credencial"): instantes UTC, `since`
// inclusivo e `until` exclusivo, e o @usuário de uma Pessoa, sem o `@`.
export class BotMessagesQuery {
  @IsOptional()
  @IsISO8601({ strict: true })
  since?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  until?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  author_username?: string;
}
