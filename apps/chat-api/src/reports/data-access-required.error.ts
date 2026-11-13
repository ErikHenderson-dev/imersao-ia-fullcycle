import { DomainError } from '../common/errors/domain.error';

// Quem pediu o download do Relatório não tem Permissão de dados naquele momento (spec da F14,
// "Referência ao PDF e download").
export class DataAccessRequiredError extends DomainError {
  readonly code = 'data_access_required';

  constructor() {
    super('Você não tem permissão para ver dados de negócio.');
  }
}
