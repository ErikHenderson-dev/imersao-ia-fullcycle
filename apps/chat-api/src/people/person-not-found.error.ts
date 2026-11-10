import { DomainError } from '../common/errors/domain.error';

// A Pessoa procurada não existe: pelo e-mail, no comando de contas, ou pelo id, no Perfil.
export class PersonNotFoundError extends DomainError {
  readonly code = 'person_not_found';

  constructor(readonly email?: string) {
    super(
      email
        ? `Nenhuma Pessoa com o e-mail ${email}.`
        : 'Pessoa não encontrada.',
    );
  }
}
