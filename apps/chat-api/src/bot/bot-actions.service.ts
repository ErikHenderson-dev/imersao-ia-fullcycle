import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AgentRequestsService } from '../agent-requests/agent-requests.service';
import type { BotActionType } from '../agent-requests/bot-action.entity';
import { PendingQuestionsService } from '../agent-requests/pending-questions.service';
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
    private readonly pendingQuestions: PendingQuestionsService,
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

  // As contagens que a leitura traria desde cada `since` e sem início, na Conversa do Pedido, com a
  // mesma validação das ações (spec da F11, "Rotas do bot e credencial").
  @Transactional()
  async countMessages(
    requestId: string,
    sinces: Date[],
    until: Date | undefined,
  ): Promise<{ counts: number[]; total: number }> {
    const request = await this.requests.lockForAction(requestId);
    return this.messages.countForBot(request.conversationId, sinces, until);
  }

  // O "digitando" do bot na Conversa do Pedido (LLD, "Digitando"). Não é ação: nada é gravado. Com a
  // resposta ou a pergunta já gravada, não emite, para um aviso atrasado não pôr o bot de volta na
  // lista depois da resposta. A emissão sai com o Pedido ainda travado: a resposta, que espera a
  // trava, só emite o fim depois dela.
  @Transactional()
  async typing(requestId: string): Promise<void> {
    const request = await this.requests.lockForAction(requestId);
    if (await this.requests.hasAnswer(request.id)) return;
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
    const { message, created } = await this.record(requestId, 'reply', body);
    if (created) this.announceAnswer(message);
    return message;
  }

  // Grava a pergunta do bot com as Respostas prontas e abre a Pergunta pendente de quem pediu,
  // encerrando a anterior dela na Conversa (spec da F11, "Envio e Pergunta pendente"). Repetida,
  // devolve a Mensagem já gravada, como a resposta.
  async question(
    requestId: string,
    body: string,
    quickReplies: string[],
  ): Promise<MessageView> {
    const { message, created, closedQuestion } = await this.record(
      requestId,
      'question',
      body,
      quickReplies,
    );
    if (!created) return message;
    this.announceAnswer(message);
    if (closedQuestion) {
      this.messages.publishQuestionClosed(
        closedQuestion,
        message.conversationId,
      );
    }
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

  // A ação gravada uma vez por Pedido e tipo (LLD, "Concorrência e idempotência", "Ação de bot"),
  // com o Pedido travado. A pergunta leva os rótulos e abre a Pergunta pendente, e devolve a
  // Mensagem da pergunta anterior que ela encerrou.
  @Transactional()
  private async record(
    requestId: string,
    actionType: BotActionType,
    body: string,
    quickReplies: string[] | null = null,
  ): Promise<{
    message: MessageView;
    created: boolean;
    closedQuestion: string | null;
  }> {
    const request = await this.requests.lockForAction(requestId);
    const existingId = await this.requests.findActionMessageId(
      request.id,
      actionType,
    );
    if (existingId) {
      return {
        message: await this.messages.viewById(existingId),
        created: false,
        closedQuestion: null,
      };
    }
    const inserted = await this.messages.insertBotMessage(
      request.botId,
      request.conversationId,
      body,
      quickReplies,
    );
    await this.requests.recordAction(request.id, actionType, inserted.id);
    if (!quickReplies) {
      return { message: inserted, created: true, closedQuestion: null };
    }
    const { opened, closed } = await this.pendingQuestions.open(
      request,
      inserted.id,
    );
    return {
      // Com a Pergunta pendente que acabou de abrir, que dá o resto das Respostas prontas.
      message: {
        ...inserted,
        quickReplies: {
          options: quickReplies,
          ownerId: opened.personId,
          expiresAt: opened.expiresAt,
          closed: false,
        },
      },
      created: true,
      closedQuestion: closed?.questionMessageId ?? null,
    };
  }
}
