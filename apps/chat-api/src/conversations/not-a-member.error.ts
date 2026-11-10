import { DomainError } from '../common/errors/domain.error';

// A Pessoa pedida ao comando de canais não participa do Canal.
export class NotAMemberError extends DomainError {
  readonly code = 'validation_failed';

  constructor(personName: string, channelName: string) {
    super(`${personName} não é Membro de #${channelName}.`);
  }
}
