import { DomainError } from '../common/errors/domain.error';

// A Mensagem da marca não existe ou é de uma Conversa de que a Pessoa não é Membro: a mesma
// resposta das rotas de Mensagem (spec da F08, "Rotas").
export class ActivityMessageNotFoundError extends DomainError {
  readonly code = 'message_not_found';

  constructor() {
    super('Mensagem não encontrada.');
  }
}
