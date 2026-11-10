import { DomainError } from '../common/errors/domain.error';

// A Citação aponta para uma Mensagem que não é da mesma Conversa, não existe ou foi apagada (spec
// da F06, "Enviar com Citação").
export class QuotedMessageNotFoundError extends DomainError {
  readonly code = 'quoted_message_not_found';

  constructor() {
    super('A Mensagem citada não existe nesta Conversa.');
  }
}
