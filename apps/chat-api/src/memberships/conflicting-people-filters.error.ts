import { DomainError } from '../common/errors/domain.error';

// A busca de Pessoas com member_of e not_member_of juntos (spec da F06, "Busca de Pessoas para a
// lista de menções"): um filtro contradiz o outro.
export class ConflictingPeopleFiltersError extends DomainError {
  readonly code = 'validation_failed';

  constructor() {
    super('Use member_of ou not_member_of, não os dois.');
  }
}
