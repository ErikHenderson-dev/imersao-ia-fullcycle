import { DomainError } from '../common/errors/domain.error';

// Só o autor edita ou apaga a Mensagem (PRD da F06, "Regras desta funcionalidade").
export class MessageNotOwnedError extends DomainError {
  readonly code = 'message_not_owned';

  constructor() {
    super('Só quem escreveu a Mensagem pode mudá-la.');
  }
}
