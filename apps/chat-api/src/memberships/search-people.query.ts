import {
  IsEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

// Busca de Pessoas (spec da F04, "Busca de Pessoas"; spec da F05, "Busca"): para adicionar a uma
// Conversa, sem os Membros dela; no "Nova conversa", sem filtro; ou na lista de menções, só com os
// Membros de uma Conversa (spec da F06, "Busca de Pessoas para a lista de menções").
export class SearchPeopleQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  not_member_of?: string;

  // Junto com not_member_of, a busca não faz sentido: a validação recusa.
  @ValidateIf((query: SearchPeopleQuery) => query.not_member_of !== undefined)
  @IsEmpty()
  @IsOptional()
  @IsUUID()
  member_of?: string;
}
