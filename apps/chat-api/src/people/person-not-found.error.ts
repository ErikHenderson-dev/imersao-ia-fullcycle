import { DomainError } from '../common/errors/domain.error';

// A Pessoa procurada não existe: pelo e-mail, no comando de contas, ou pelo id, no Perfil.
export class PersonNotFoundError extends DomainError {
  readonly code = 'person_not_found';

  // Pelo id, a mensagem não traz o e-mail: passe null de propósito.
  constructor(readonly email: string | null) {
    super(
      email
        ? `Nenhuma Pessoa com o e-mail ${email}.`
        : 'Pessoa não encontrada.',
    );
  }
}
