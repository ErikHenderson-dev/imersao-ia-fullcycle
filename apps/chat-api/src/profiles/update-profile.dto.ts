import { IsOptional, IsString, ValidateIf } from 'class-validator';

// O próprio Perfil (spec da F09, "Rotas"): todos os campos opcionais. O nome é texto e não aceita
// nulo; o cargo e o telefone aceitam nulo, que os apaga. A regra de cada campo é a do service,
// com a mesma mensagem do comando de contas.
export class UpdateProfileDto {
  @ValidateIf((body: UpdateProfileDto) => body.name !== undefined)
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
