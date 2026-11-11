import { DomainError } from '../common/errors/domain.error';

// O agent_username do envio não é o @usuário de um bot (spec da F11, "Envio e Pergunta pendente").
export class BotNotFoundError extends DomainError {
  readonly code = 'bot_not_found';

  constructor() {
    super('Não há bot com esse @usuário.');
  }
}
