import { DomainError } from '../common/errors/domain.error';

// Passou a validade do identificador de pedido (LLD, "Valores e configuração").
export class RequestExpiredError extends DomainError {
  readonly code = 'request_expired';

  constructor() {
    super('O Pedido venceu.');
  }
}
