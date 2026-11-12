import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import {
  AgentRequest,
  type AgentRequestClosedStatus,
} from './agent-request.entity';
import {
  AGENT_REQUEST_TTL_MS,
  LONG_AGENT_REQUEST_TTL_MS,
} from './agent-request-values';
import { BotAction, BotActionType } from './bot-action.entity';
import { RequestClosedError } from './request-closed.error';
import { RequestExpiredError } from './request-expired.error';
import { RequestNotFoundError } from './request-not-found.error';

export interface NewAgentRequest {
  conversationId: string;
  requesterId: string;
  botId: string;
  triggerMessageId: string;
}

// Os Pedidos aos Agentes e as ações de bot (spec da F11, "Pedido e ações de bot"). Quem chama abre
// a transação: o Pedido nasce com a Mensagem, e a ação grava com a Mensagem do bot.
@Injectable()
export class AgentRequestsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get requests(): Repository<AgentRequest> {
    return this.txHost.tx.getRepository(AgentRequest);
  }

  private get actions(): Repository<BotAction> {
    return this.txHost.tx.getRepository(BotAction);
  }

  // O Pedido da Mensagem, válido pela validade do identificador: `new` quando ela menciona um
  // Agente, e `continuation` quando responde à Pergunta pendente do Pedido `parentRequestId`.
  open(
    request: NewAgentRequest,
    parentRequestId: string | null = null,
  ): Promise<AgentRequest> {
    return this.requests.save(
      this.requests.create({
        ...request,
        kind: parentRequestId ? 'continuation' : 'new',
        parentRequestId,
        status: 'open',
        expiresAt: new Date(Date.now() + AGENT_REQUEST_TTL_MS),
      }),
    );
  }

  // Encerra o Pedido de quem pediu (spec da F11, "Pedido e ações de bot"). Um UPDATE só, condicionado
  // ao `open`: o `lockForAction` de uma ação concorrente vê o encerramento depois do commit, e o
  // Pedido já encerrado fica como está. O de outra Pessoa é desconhecido para quem chama.
  async close(
    personId: string,
    requestId: string,
    status: AgentRequestClosedStatus,
  ): Promise<void> {
    if (!isUUID(requestId)) throw new RequestNotFoundError();
    const mine = { id: requestId, requesterId: personId };
    const { affected } = await this.requests.update(
      { ...mine, status: 'open' },
      { status },
    );
    if (!affected && !(await this.requests.existsBy(mine))) {
      throw new RequestNotFoundError();
    }
  }

  // O Pedido que a Mensagem criou, ou null: o reenvio da Mensagem devolve o mesmo.
  findByTriggerMessage(messageId: string): Promise<AgentRequest | null> {
    return this.requests.findOneBy({ triggerMessageId: messageId });
  }

  // O Pedido em que o bot vai agir, travado até o fim da transação: duas ações do mesmo Pedido
  // ficam em fila, e a segunda encontra a primeira já gravada. Recusa o Pedido inexistente (ou de
  // id malformado), o encerrado e o vencido, nesta ordem: encerrar é definitivo.
  async lockForAction(requestId: string): Promise<AgentRequest> {
    const request = isUUID(requestId)
      ? await this.requests
          .createQueryBuilder('request')
          .setLock('pessimistic_write')
          .where('request.id = :requestId', { requestId })
          .getOne()
      : null;
    if (!request) throw new RequestNotFoundError();
    if (request.status !== 'open') throw new RequestClosedError();
    if (request.expiresAt.getTime() <= Date.now()) {
      throw new RequestExpiredError();
    }
    return request;
  }

  // Se o Pedido já tem uma ação gravada: toda ação de bot responde ao Pedido, e depois dela o bot
  // já não está digitando (LLD, "Digitando").
  hasAnswer(requestId: string): Promise<boolean> {
    return this.actions.existsBy({ requestId });
  }

  // As ações já gravadas no Pedido, com a Mensagem de cada uma.
  findActions(
    requestId: string,
  ): Promise<Pick<BotAction, 'actionType' | 'messageId'>[]> {
    return this.actions.find({
      select: { actionType: true, messageId: true },
      where: { requestId },
    });
  }

  // O Aviso de início estende a validade do Pedido demorado, contada a partir dele, para a entrega
  // ou a falha poderem chegar minutos depois (spec da F14, "Ações de bot do Relatório"). Dentro da
  // transação da ação, com o Pedido travado.
  async extendForReport(requestId: string): Promise<void> {
    await this.requests.update(
      { id: requestId },
      { expiresAt: new Date(Date.now() + LONG_AGENT_REQUEST_TTL_MS) },
    );
  }

  async recordAction(
    requestId: string,
    actionType: BotActionType,
    messageId: string,
  ): Promise<void> {
    await this.actions.insert({ requestId, actionType, messageId });
  }
}

// O Pedido na resposta do envio (spec da F11, "Envio e Pergunta pendente").
export interface AgentRequestView {
  id: string;
  kind: AgentRequest['kind'];
  botUsername: string;
  parentRequestId: string | null;
}

export function toAgentRequestView(
  request: AgentRequest,
  botUsername: string,
): AgentRequestView {
  return {
    id: request.id,
    kind: request.kind,
    botUsername,
    parentRequestId: request.parentRequestId,
  };
}
