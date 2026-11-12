import { DomainError } from '../common/errors/domain.error';

// O Pedido foi encerrado como failed ou cancelled: o bot não age mais nele.
export class RequestClosedError extends DomainError {
  readonly code = 'request_closed';

  constructor() {
    super('O Pedido já foi encerrado.');
  }
}
