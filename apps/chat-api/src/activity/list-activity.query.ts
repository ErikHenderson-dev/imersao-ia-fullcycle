import { IsIn, IsOptional } from 'class-validator';
import { ListMessagesQuery } from '../messages/list-messages.query';
import type { ActivityFilter } from '../notifications/notification-finder';

const FILTERS: ActivityFilter[] = ['all', 'mentions', 'direct'];

// A lista de Atividade (spec da F08, "Rotas"): o tipo e a mesma paginação do histórico (LLD,
// "Interfaces"), com `before` sendo o id da Mensagem mais antiga já recebida.
export class ListActivityQuery extends ListMessagesQuery {
  @IsOptional()
  @IsIn(FILTERS)
  kind: ActivityFilter = 'all';
}
