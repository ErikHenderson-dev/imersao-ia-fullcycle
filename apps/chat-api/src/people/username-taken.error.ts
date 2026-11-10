import { DomainError } from '../common/errors/domain.error';

// O @usuário informado na criação da conta já é de outra Pessoa.
export class UsernameTakenError extends DomainError {
  readonly code = 'validation_failed';

  constructor(readonly username: string) {
    super(`O @usuário ${username} já é de outra Pessoa.`);
  }
}
