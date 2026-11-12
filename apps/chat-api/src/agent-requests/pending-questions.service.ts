import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import type { AgentRequest } from './agent-request.entity';
import { PENDING_QUESTION_TTL_MS } from './agent-request-values';
import { PendingQuestion } from './pending-question.entity';

// A Pergunta pendente como a Mensagem da pergunta a mostra: de quem é, até quando vale e se já se
// encerrou (spec da F11, "Envio e Pergunta pendente").
export interface PendingQuestionView {
  ownerId: string;
  expiresAt: Date;
  closed: boolean;
}

// A pergunta que uma Mensagem encerrou: o Pedido que perguntou, o bot dele, a Mensagem da pergunta e
// até quando ela valia.
export interface ClosedQuestion {
  requestId: string;
  botId: string;
  questionMessageId: string;
  expiresAt: Date;
}

// As Perguntas pendentes (LLD, "Pedido ao agente e Pergunta pendente"). Quem chama abre a
// transação: a pergunta nasce com a Mensagem do bot, e se encerra com a Mensagem de quem pediu.
@Injectable()
export class PendingQuestionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get questions(): Repository<PendingQuestion> {
    return this.txHost.tx.getRepository(PendingQuestion);
  }

  // Abre a pergunta do Pedido para quem pediu, encerrando antes a que estiver aberta para a mesma
  // Pessoa e Conversa. Devolve a aberta e a encerrada, ou null.
  async open(
    request: AgentRequest,
    questionMessageId: string,
  ): Promise<{ opened: PendingQuestion; closed: ClosedQuestion | null }> {
    // Sem pergunta aberta, o UPDATE do encerramento não trava nada: duas perguntas ao mesmo tempo
    // para a mesma Pessoa e Conversa entram em fila por esta trava, e a segunda encerra a primeira
    // em vez de esbarrar na única das abertas.
    await this.txHost.tx.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`pending_questions:${request.conversationId}:${request.requesterId}`],
    );
    const closed = await this.takeOpen(
      request.conversationId,
      request.requesterId,
    );
    const opened = this.questions.create({
      requestId: request.id,
      conversationId: request.conversationId,
      personId: request.requesterId,
      botId: request.botId,
      questionMessageId,
      expiresAt: new Date(Date.now() + PENDING_QUESTION_TTL_MS),
      closedAt: null,
    });
    await this.questions.insert(opened);
    return { opened, closed };
  }

  // Encerra a pergunta aberta da Pessoa na Conversa, vencida ou não, e a devolve, ou null. O UPDATE
  // trava a linha até o commit: o segundo de dois envios simultâneos a relê já encerrada.
  async takeOpen(
    conversationId: string,
    personId: string,
  ): Promise<ClosedQuestion | null> {
    // No UPDATE, o driver devolve as linhas e a contagem.
    const [rows] = await this.txHost.tx.query<
      [
        {
          request_id: string;
          bot_id: string;
          question_message_id: string;
          expires_at: Date;
        }[],
        number,
      ]
    >(
      `UPDATE pending_questions SET closed_at = now(), updated_at = now()
        WHERE conversation_id = $1 AND person_id = $2 AND closed_at IS NULL
        RETURNING request_id, bot_id, question_message_id, expires_at`,
      [conversationId, personId],
    );
    const [row] = rows;
    return row
      ? {
          requestId: row.request_id,
          botId: row.bot_id,
          questionMessageId: row.question_message_id,
          expiresAt: row.expires_at,
        }
      : null;
  }

  // As perguntas dessas Mensagens, pelo id da Mensagem.
  async viewsByMessages(
    messageIds: string[],
  ): Promise<Map<string, PendingQuestionView>> {
    const views = new Map<string, PendingQuestionView>();
    if (messageIds.length === 0) return views;
    const found = await this.questions.findBy({
      questionMessageId: In(messageIds),
    });
    for (const question of found) {
      views.set(question.questionMessageId, {
        ownerId: question.personId,
        expiresAt: question.expiresAt,
        closed: question.closedAt !== null,
      });
    }
    return views;
  }
}

// Vencida no instante dado: a pergunta não vale mais, mesmo aberta.
export function isExpired(
  question: { expiresAt: Date },
  now = Date.now(),
): boolean {
  return question.expiresAt.getTime() <= now;
}
