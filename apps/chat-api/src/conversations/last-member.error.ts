import { DomainError } from '../common/errors/domain.error';

// Sem o último Membro, o Canal privado ficaria sem ninguém para adicionar outras Pessoas, e o nome
// dele, preso para sempre.
export class LastMemberError extends DomainError {
  readonly code = 'validation_failed';

  constructor(personName: string, channelName: string) {
    super(
      `${personName} é o último Membro de #${channelName} e não pode sair.`,
    );
  }
}
