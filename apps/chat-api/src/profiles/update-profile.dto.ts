import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { NoNullCharacter } from '../common/validation/no-null-character';

// O próprio Perfil (spec da F09, "Rotas"): todos os campos opcionais. O nome é texto e não aceita
// nulo; o cargo e o telefone aceitam nulo, que os apaga. A regra de cada campo é a do service,
// com a mesma mensagem do comando de contas.
export class UpdateProfileDto {
  @ValidateIf((body: UpdateProfileDto) => body.name !== undefined)
  @IsString()
  @NoNullCharacter()
  name?: string;

  @IsOptional()
  @IsString()
  @NoNullCharacter()
  title?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  status_emoji?: string | null;

  @IsOptional()
  @IsString()
  @NoNullCharacter()
  status_text?: string | null;
}
