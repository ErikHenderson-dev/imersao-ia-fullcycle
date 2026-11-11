import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AgentRequestsService } from '../agent-requests/agent-requests.service';
import { MessagesService } from '../messages/messages.service';
import type {
  BotReadFilter,
  BotReadPage,
  MessageView,
} from '../messages/messages.service';
import { SUMMARY_MESSAGE_LIMIT } from './bot-values';

// As ações do bot na Conversa, sempre dentro de um Pedido real (ADR 0011; spec da F11, "Rotas do bot
// e credencial"): a Conversa e o bot vêm do Pedido, e nunca de quem chama.
@Injectable()
export class BotActionsService {
  constructor(
    private readonly requests: AgentRequestsService,
    private readonly messages: MessagesService,
  ) {}

  // As Mensagens de Pessoas do Recorte, na Conversa do Pedido, no máximo as do teto do resumo, com
  // a contagem do Recorte inteiro. O Pedido passa pela mesma validação das ações.
  @Transactional()
  async readMessages(
    requestId: string,
    filter: BotReadFilter,
  ): Promise<BotReadPage> {
    const request = await this.requests.lockForAction(requestId);
    return this.messages.listForBot(
      request.conversationId,
      filter,
      SUMMARY_MESSAGE_LIMIT,
    );
  }

  // Grava a resposta do bot ao Pedido. Repetida, devolve a Mensagem já gravada, sem gravar nem
  // publicar (LLD, "Concorrência e idempotência", "Ação de bot").
  async reply(requestId: string, body: string): Promise<MessageView> {
    const { message, created } = await this.recordReply(requestId, body);
    if (created) this.messages.publishBotMessage(message);
    return message;
  }

  @Transactional()
  private async recordReply(
    requestId: string,
    body: string,
  ): Promise<{ message: MessageView; created: boolean }> {
    const request = await this.requests.lockForAction(requestId);
    const existingId = await this.requests.findActionMessageId(
      request.id,
      'reply',
    );
    if (existingId) {
      return {
        message: await this.messages.viewById(existingId),
        created: false,
      };
    }
    const message = await this.messages.insertBotMessage(
      request.botId,
      request.conversationId,
      body,
    );
    await this.requests.recordAction(request.id, 'reply', message.id);
    return { message, created: true };
  }
}
