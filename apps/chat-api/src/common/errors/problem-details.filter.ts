import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainError } from './domain.error';
import { ERROR_STATUS, ErrorCode } from './error-code';

const DETAILS: Record<ErrorCode, string> = {
  validation_failed: 'Os dados enviados são inválidos.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  unauthenticated: 'Sessão ausente ou inválida.',
  too_many_login_attempts:
    'Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo.',
  email_already_exists: 'Já existe uma Pessoa com esse e-mail.',
  person_not_found: 'Pessoa não encontrada.',
  conversation_not_found: 'Conversa não encontrada.',
  channel_name_taken: 'Já existe um canal com esse nome.',
  members_not_editable: 'Só é possível adicionar pessoas a um canal privado.',
  message_not_found: 'Mensagem não encontrada.',
  message_not_owned: 'Só quem escreveu a Mensagem pode mudá-la.',
  forbidden: 'Só administradores podem fazer isso.',
  quoted_message_not_found: 'A Mensagem citada não existe nesta Conversa.',
  not_found: 'Recurso não encontrado.',
  payload_too_large: 'O corpo da requisição é grande demais.',
  request_rejected: 'A requisição foi recusada.',
  bot_not_found: 'Não há bot com esse @usuário.',
  invalid_bot_token: 'Credencial de bot ausente ou inválida.',
  request_not_found: 'Pedido não encontrado.',
  request_closed: 'O Pedido já foi encerrado.',
  request_expired: 'O Pedido venceu.',
  assignee_not_member:
    'O Responsável precisa ser Membro da Conversa do Pedido.',
  assignee_is_bot: 'Uma Tarefa não pode ser delegada a um Agente.',
  task_not_found: 'Tarefa não encontrada.',
  task_not_assignee: 'Só o Responsável conclui e reabre a Tarefa.',
  internal_error: 'Erro interno. Tente novamente mais tarde.',
};

const CLIENT_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'validation_failed',
  404: 'not_found',
  413: 'payload_too_large',
};

interface Resolved {
  status: number;
  code: ErrorCode;
  detail: string;
  retryAfterSeconds?: number;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, code, detail, retryAfterSeconds } = this.resolve(exception);
    const body = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      detail,
      code,
    };
    const response = host.switchToHttp().getResponse<unknown>();
    const adapter = this.httpAdapterHost.httpAdapter;
    adapter.setHeader(response, 'Content-Type', 'application/problem+json');
    if (retryAfterSeconds !== undefined) {
      adapter.setHeader(response, 'Retry-After', String(retryAfterSeconds));
    }
    adapter.reply(response, JSON.stringify(body), status);
  }

  private resolve(exception: unknown): Resolved {
    if (exception instanceof DomainError) {
      return {
        status: ERROR_STATUS[exception.code],
        code: exception.code,
        detail: exception.message,
        retryAfterSeconds: exception.retryAfterSeconds,
      };
    }
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : this.bodyReaderStatus(exception);
    if (status !== undefined && status < 500) {
      return this.build(
        status,
        CLIENT_ERROR_CODE[status] ?? 'request_rejected',
      );
    }
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    return this.build(500, 'internal_error');
  }

  private build(status: number, code: ErrorCode): Resolved {
    return { status, code, detail: DETAILS[code] };
  }

  // Erros do leitor do corpo do Express (JSON malformado, corpo grande) trazem
  // `type` e `status`; qualquer outro erro com `statusCode` próprio é inesperado.
  private bodyReaderStatus(exception: unknown): number | undefined {
    if (typeof exception !== 'object' || exception === null) return undefined;
    const { type, status } = exception as { type?: unknown; status?: unknown };
    if (
      typeof type === 'string' &&
      type.startsWith('entity.') &&
      typeof status === 'number' &&
      status >= 400 &&
      status < 500
    ) {
      return status;
    }
    return undefined;
  }
}
