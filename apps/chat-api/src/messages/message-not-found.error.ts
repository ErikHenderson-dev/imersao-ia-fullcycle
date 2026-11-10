import { DomainError } from '../common/errors/domain.error';

// Mensagem inexistente, apagada, de outra Conversa ou de uma Conversa de que a Pessoa não é
// Membro: a mesma resposta, para não revelar qual dos casos (spec da F06, "Mensagens").
export class MessageNotFoundError extends DomainError {
  readonly code = 'message_not_found';

  constructor() {
    super('Mensagem não encontrada.');
  }
}
