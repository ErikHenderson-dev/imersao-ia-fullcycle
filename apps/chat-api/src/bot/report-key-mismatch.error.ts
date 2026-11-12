import { DomainError } from '../common/errors/domain.error';

// A chave do PDF não é a do Pedido da entrega (spec da F14, "Armazenamento"): uma entrega nunca
// aponta para o arquivo de outro Pedido, de outra Conversa.
export class ReportKeyMismatchError extends DomainError {
  readonly code = 'validation_failed';

  constructor() {
    super('A chave do PDF não é a do Pedido.');
  }
}
