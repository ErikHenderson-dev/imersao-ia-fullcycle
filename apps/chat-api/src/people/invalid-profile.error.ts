import { DomainError } from '../common/errors/domain.error';

// Um campo do Perfil fora da regra (spec da F05, "Pessoas"); a mensagem diz o motivo.
export class InvalidProfileError extends DomainError {
  readonly code = 'validation_failed';
}
