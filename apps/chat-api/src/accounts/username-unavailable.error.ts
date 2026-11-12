import { DomainError } from '../common/errors/domain.error';

export type UsernameOwner = 'person' | 'bot';

// O @usuário pedido já tem dono, numa Pessoa ou num bot (spec da F10, "Bots").
export class UsernameUnavailableError extends DomainError {
  readonly code = 'validation_failed';

  constructor(
    readonly username: string,
    readonly owner: UsernameOwner,
  ) {
    super(
      owner === 'person'
        ? `O @usuário ${username} já é de uma Pessoa.`
        : `O @usuário ${username} já é de um bot.`,
    );
  }
}
