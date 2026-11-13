import { DomainError } from '../common/errors/domain.error';

// A entrega ou a falha do Relatório chegou num Pedido sem o Aviso de início (spec da F14, "Ações de
// bot do Relatório").
export class ReportNotStartedError extends DomainError {
  readonly code = 'report_not_started';

  constructor() {
    super('O Relatório não foi iniciado.');
  }
}
