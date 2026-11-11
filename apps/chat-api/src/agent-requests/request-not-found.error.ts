import { DomainError } from '../common/errors/domain.error';

// O identificador de pedido não existe ou está malformado (spec da F11, "Pedido e ações de bot").
export class RequestNotFoundError extends DomainError {
  readonly code = 'request_not_found';

  constructor() {
    super('Pedido não encontrado.');
  }
}
