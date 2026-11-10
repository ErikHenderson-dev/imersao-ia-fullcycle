import { IsOptional, IsString, IsUUID } from 'class-validator';

// Busca de Pessoas (spec da F04, "Busca de Pessoas"; spec da F05, "Busca"): para adicionar a uma
// Conversa, sem os Membros dela, ou no "Nova conversa", sem not_member_of.
export class SearchPeopleQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  not_member_of?: string;
}
