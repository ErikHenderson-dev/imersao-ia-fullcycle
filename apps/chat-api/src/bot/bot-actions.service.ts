import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AgentRequestsService } from '../agent-requests/agent-requests.service';
import { MessagesService, MessageView } from '../messages/messages.service';

// As ações do bot na Conversa, sempre dentro de um Pedido real (ADR 0011; spec da F11, "Rotas do bot
// e credencial"): a Conversa e o bot vêm do Pedido, e nunca de quem chama.
@Injectable()
export class BotActionsService {
  constructor(
    private readonly requests: AgentRequestsService,
    private readonly messages: MessagesService,
  ) {}

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
