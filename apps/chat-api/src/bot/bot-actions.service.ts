import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AgentRequestsService } from '../agent-requests/agent-requests.service';
import { BotsService } from '../bots/bots.service';
import { MessagesService, toAuthor } from '../messages/messages.service';
import type {
  BotReadFilter,
  BotReadPage,
  MessageView,
} from '../messages/messages.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { SUMMARY_MESSAGE_LIMIT } from './bot-values';

// As ações do bot na Conversa, sempre dentro de um Pedido real (ADR 0011; spec da F11, "Rotas do bot
// e credencial"): a Conversa e o bot vêm do Pedido, e nunca de quem chama.
@Injectable()
export class BotActionsService {
  constructor(
    private readonly requests: AgentRequestsService,
    private readonly messages: MessagesService,
    private readonly bots: BotsService,
    private readonly realtime: RealtimePublisher,
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

  // O "digitando" do bot na Conversa do Pedido (LLD, "Digitando"). Não é ação: nada é gravado. Com a
  // resposta ou a pergunta já gravada, não emite, para um aviso atrasado não pôr o bot de volta na
  // lista depois da resposta.
  async typing(requestId: string): Promise<void> {
    const request = await this.unansweredRequest(requestId);
    if (!request) return;
    const [bot] = await this.bots.findByIds([request.botId]);
    this.realtime.botTyping(
      'typing.start',
      request.conversationId,
      toAuthor('bot', bot),
    );
  }

  // Grava a resposta do bot ao Pedido e emite o fim do "digitando". Repetida, devolve a Mensagem já
  // gravada, sem gravar nem publicar (LLD, "Concorrência e idempotência", "Ação de bot").
  async reply(requestId: string, body: string): Promise<MessageView> {
    const { message, created } = await this.recordReply(requestId, body);
    if (created) this.announceAnswer(message);
    return message;
  }

  // A resposta ou a pergunta gravada: publica a Mensagem e emite o fim do "digitando" do bot.
  private announceAnswer(message: MessageView): void {
    this.messages.publishBotMessage(message);
    this.realtime.botTyping(
      'typing.stop',
      message.conversationId,
      message.author,
    );
  }

  // O Pedido válido e ainda sem resposta, ou null. A trava põe o aviso em fila com a gravação da
  // resposta: o que trava depois dela a encontra.
  @Transactional()
  private async unansweredRequest(
    requestId: string,
  ): Promise<{ conversationId: string; botId: string } | null> {
    const request = await this.requests.lockForAction(requestId);
    return (await this.requests.hasAnswer(request.id)) ? null : request;
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
