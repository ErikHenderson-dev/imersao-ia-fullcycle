import { DomainError } from '../common/errors/domain.error';

// A ação é só de administrador, e a Pessoa da Sessão não tem o papel (spec da F10, "Papel de
// administrador").
export class NotAdminError extends DomainError {
  readonly code = 'forbidden';

  constructor() {
    super('Só administradores podem fazer isso.');
  }
}
