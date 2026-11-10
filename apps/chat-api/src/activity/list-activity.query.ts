import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  MESSAGE_PAGE_MAX_SIZE,
  MESSAGE_PAGE_SIZE,
} from '../messages/message-values';
import type { ActivityFilter } from './notification-finder';

const FILTERS: ActivityFilter[] = ['all', 'mentions', 'direct'];

// A lista de Atividade (spec da F08, "Rotas"): o tipo e a paginação do LLD ("Interfaces"), com
// `before` sendo o id da Mensagem mais antiga já recebida.
export class ListActivityQuery {
  @IsOptional()
  @IsIn(FILTERS)
  kind: ActivityFilter = 'all';

  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGE_PAGE_MAX_SIZE)
  limit: number = MESSAGE_PAGE_SIZE;
}
