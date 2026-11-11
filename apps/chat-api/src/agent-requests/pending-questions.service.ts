import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { In, IsNull, Repository } from 'typeorm';
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
  // Pessoa e Conversa. Devolve a encerrada, ou null.
  async open(
    request: AgentRequest,
    questionMessageId: string,
  ): Promise<PendingQuestion | null> {
    const closed = await this.takeOpen(
      request.conversationId,
      request.requesterId,
    );
    await this.questions.insert(
      this.questions.create({
        requestId: request.id,
        conversationId: request.conversationId,
        personId: request.requesterId,
        botId: request.botId,
        questionMessageId,
        expiresAt: new Date(Date.now() + PENDING_QUESTION_TTL_MS),
        closedAt: null,
      }),
    );
    return closed;
  }

  // Encerra a pergunta aberta da Pessoa na Conversa, vencida ou não, e a devolve, ou null. A linha
  // fica travada até o commit: o segundo de dois envios simultâneos a relê já encerrada.
  async takeOpen(
    conversationId: string,
    personId: string,
  ): Promise<PendingQuestion | null> {
    const open = await this.questions
      .createQueryBuilder('question')
      .setLock('pessimistic_write')
      .where('question.conversationId = :conversationId', { conversationId })
      .andWhere('question.personId = :personId', { personId })
      .andWhere('question.closedAt IS NULL')
      .getOne();
    if (!open) return null;
    open.closedAt = new Date();
    await this.questions.update(
      { id: open.id, closedAt: IsNull() },
      { closedAt: open.closedAt },
    );
    return open;
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
  question: PendingQuestion,
  now = Date.now(),
): boolean {
  return question.expiresAt.getTime() <= now;
}
