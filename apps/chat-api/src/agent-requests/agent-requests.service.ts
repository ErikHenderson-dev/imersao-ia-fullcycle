import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { In, Repository } from 'typeorm';
import {
  AgentRequest,
  type AgentRequestClosedStatus,
} from './agent-request.entity';
import { AGENT_REQUEST_TTL_MS } from './agent-request-values';
import { BotAction, BotActionType } from './bot-action.entity';
import { RequestClosedError } from './request-closed.error';
import { RequestExpiredError } from './request-expired.error';
import { RequestNotFoundError } from './request-not-found.error';

// As ações que respondem ao Pedido: depois de uma delas, o bot já não está digitando (LLD,
// "Digitando").
const ANSWER_ACTIONS: BotActionType[] = ['reply', 'question'];

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

  // O Pedido `new` da Mensagem que menciona um Agente, válido pela validade do identificador.
  openNew(request: NewAgentRequest): Promise<AgentRequest> {
    return this.requests.save(
      this.requests.create({
        ...request,
        kind: 'new',
        parentRequestId: null,
        status: 'open',
        expiresAt: new Date(Date.now() + AGENT_REQUEST_TTL_MS),
      }),
    );
  }

  // A continuação: a resposta de quem pediu à Pergunta pendente, apontando para o Pedido que
  // perguntou, com a mesma validade do Pedido new.
  openContinuation(
    request: NewAgentRequest & { parentRequestId: string },
  ): Promise<AgentRequest> {
    return this.requests.save(
      this.requests.create({
        ...request,
        kind: 'continuation',
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

  // A Mensagem que a ação já gravou neste Pedido, ou null.
  async findActionMessageId(
    requestId: string,
    actionType: BotActionType,
  ): Promise<string | null> {
    const action = await this.actions.findOneBy({ requestId, actionType });
    return action?.messageId ?? null;
  }

  // Se o Pedido já tem a resposta ou a pergunta gravada.
  hasAnswer(requestId: string): Promise<boolean> {
    return this.actions.existsBy({
      requestId,
      actionType: In(ANSWER_ACTIONS),
    });
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
