import { DomainError } from '../common/errors/domain.error';

// A rota /v1/bot chegou sem a credencial de bot, ou com a errada (LLD, "Segurança").
export class InvalidBotTokenError extends DomainError {
  readonly code = 'invalid_bot_token';

  constructor() {
    super('Credencial de bot ausente ou inválida.');
  }
}
