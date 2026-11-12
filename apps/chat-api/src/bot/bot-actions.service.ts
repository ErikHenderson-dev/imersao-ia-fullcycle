import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AgentRequestsService } from '../agent-requests/agent-requests.service';
import type { AgentRequest } from '../agent-requests/agent-request.entity';
import {
  REPORT_TERMINAL_ACTIONS,
  type BotActionType,
} from '../agent-requests/bot-action.entity';
import { ReportNotStartedError } from '../agent-requests/report-not-started.error';
import { RequestClosedError } from '../agent-requests/request-closed.error';
import { PendingQuestionsService } from '../agent-requests/pending-questions.service';
import { BotsService } from '../bots/bots.service';
import { PeopleService } from '../people/people.service';
import { MessagesService, toAuthor } from '../messages/messages.service';
import type {
  BotReadFilter,
  BotReadPage,
  MessageView,
  NewReport,
} from '../messages/messages.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ActivityPublisher } from '../notifications/activity.publisher';
import { partiesOf } from '../tasks/task.entity';
import { notificationFor, toTaskResponse } from '../tasks/task.response';
import { TasksService, type TaskView } from '../tasks/tasks.service';
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
    private readonly tasks: TasksService,
    private readonly activity: ActivityPublisher,
    private readonly people: PeopleService,
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
  // Com a marca "dados de negócio" quando a resposta traz números do negócio (spec da F13).
  async reply(
    requestId: string,
    body: string,
    businessData = false,
  ): Promise<MessageView> {
    const { message, written } = await this.once(
      requestId,
      'reply',
      async (request) => ({
        message: await this.messages.insertBotMessage(
          request.botId,
          request.conversationId,
          body,
          { businessData },
        ),
      }),
    );
    if (written) this.announceAnswer(message);
    return message;
  }

  // Grava a pergunta do bot com as Respostas prontas e abre a Pergunta pendente de quem pediu,
  // encerrando a anterior dela na Conversa (spec da F11, "Envio e Pergunta pendente"). Repetida,
  // devolve a Mensagem já gravada, como a resposta.
  async question(
    requestId: string,
    body: string,
    quickReplies: string[],
    businessData = false,
  ): Promise<MessageView> {
    const { message, written } = await this.once(
      requestId,
      'question',
      async (request) => {
        const inserted = await this.messages.insertBotMessage(
          request.botId,
          request.conversationId,
          body,
          { quickReplies, businessData },
        );
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
          closedQuestion: closed?.questionMessageId ?? null,
        };
      },
    );
    if (!written) return message;
    this.announceAnswer(message);
    if (written.closedQuestion) {
      this.messages.publishQuestionClosed(
        written.closedQuestion,
        message.conversationId,
      );
    }
    return message;
  }

  // Delega a Tarefa ao Membro da Conversa do Pedido e grava a confirmação do bot, numa transação
  // (spec da F12, "Ação `task`"). Repetida, devolve a Tarefa e a confirmação já gravadas, sem
  // conferir o Responsável de novo nem publicar. A Tarefa é montada depois do commit, fora da
  // trava do Pedido.
  async task(
    requestId: string,
    assigneeUsername: string,
    title: string,
  ): Promise<{ task: TaskView; message: MessageView }> {
    const { message, written } = await this.once(
      requestId,
      'task',
      async (request) => {
        const assignee = await this.tasks.resolveAssignee(
          request.conversationId,
          assigneeUsername,
        );
        const { task, notification } = await this.tasks.create({
          requestId: request.id,
          conversationId: request.conversationId,
          triggerMessageId: request.triggerMessageId,
          assigneeId: assignee.id,
          delegatorId: request.requesterId,
          title,
        });
        return {
          task,
          notification,
          message: await this.messages.insertBotMessage(
            request.botId,
            request.conversationId,
            `Tarefa delegada a ${assignee.name}: ${title}`,
          ),
        };
      },
    );
    if (written) this.announceAnswer(message);
    const task =
      written?.task ?? (await this.tasks.findByRequestOrFail(requestId));
    const view = await this.tasks.view(task);
    // Também na repetição: uma falha entre o commit e a publicação não deixa as Pessoas sem o
    // evento nem sem os números. Na repetição a Notificação não vai no evento, para não alertar de
    // novo; ela está em Atividade.
    const notification = written?.notification ?? null;
    const payload = toTaskResponse(view);
    void this.realtime.taskCreated(partiesOf(task), (recipientId) => ({
      task: payload,
      notification: notificationFor(notification, recipientId),
    }));
    if (task.assigneeId !== task.delegatorId) {
      this.activity.publish([task.assigneeId]);
    }
    return { task: view, message };
  }

  // Grava o Aviso de início do Relatório, com a marca "dados de negócio", estende a validade do
  // Pedido demorado e emite o fim do "digitando" (spec da F14, "Ações de bot do Relatório").
  // Repetido, devolve o aviso já gravado, sem estender de novo.
  async reportStarted(requestId: string, body: string): Promise<MessageView> {
    const { message, written } = await this.once(
      requestId,
      'report_started',
      async (request) => {
        const inserted = await this.messages.insertBotMessage(
          request.botId,
          request.conversationId,
          body,
          { businessData: true },
        );
        await this.requests.extendForReport(request.id);
        return { message: inserted };
      },
    );
    if (written) this.announceAnswer(message);
    return message;
  }

  // Grava a entrega do Relatório numa transação: a Mensagem com a marca, a referência ao PDF que o
  // Worker gravou no armazenamento e a Menção a quem pediu (spec da F14, "Ações de bot do
  // Relatório"). Repetida, devolve a entrega já gravada, sem segunda referência.
  async reportDelivered(
    requestId: string,
    report: NewReport,
  ): Promise<MessageView> {
    return this.reportOutcome(
      requestId,
      'report_delivered',
      (username) => `@${username}, o relatório está pronto.`,
      report,
    );
  }

  // Grava o "não consegui gerar o relatório" (spec da F14, "Ações de bot do Relatório").
  async reportFailed(requestId: string): Promise<MessageView> {
    return this.reportOutcome(
      requestId,
      'report_failed',
      (username) => `@${username}, não consegui gerar o relatório.`,
    );
  }

  // A entrega ou a falha: a Mensagem com a marca e a Menção a quem pediu, que recebe a Notificação de
  // Menção. O corpo é montado aqui, e não por quem chama, para a Menção ser sempre a quem pediu.
  private async reportOutcome(
    requestId: string,
    actionType: BotActionType,
    bodyFor: (username: string) => string,
    report: NewReport | null = null,
  ): Promise<MessageView> {
    const { message, written } = await this.once(
      requestId,
      actionType,
      async (request) => {
        const [{ username }] = await this.people.findByIds([
          request.requesterId,
        ]);
        return {
          message: await this.messages.insertBotMessage(
            request.botId,
            request.conversationId,
            bodyFor(username),
            { businessData: true, withMentions: true, report },
          ),
        };
      },
      admitReportOutcome,
    );
    if (written) this.announceAnswer(message);
    return message;
  }

  // A resposta, a pergunta ou a confirmação gravada: publica a Mensagem e emite o fim do
  // "digitando" do bot.
  private announceAnswer(message: MessageView): void {
    this.messages.publishBotMessage(message);
    this.realtime.botTyping(
      'typing.stop',
      message.conversationId,
      message.author,
    );
  }

  // A ação gravada uma vez por Pedido e tipo (LLD, "Concorrência e idempotência", "Ação de bot"),
  // com o Pedido travado: `write` grava a Mensagem do bot e o que a ação tem de próprio, e a
  // repetição devolve a Mensagem já gravada, sem chamar `write` (`written` nulo). Antes de gravar,
  // `admit` confere as ações já gravadas no Pedido: por padrão, uma resposta por Pedido.
  @Transactional()
  private async once<T extends { message: MessageView }>(
    requestId: string,
    actionType: BotActionType,
    write: (request: AgentRequest) => Promise<T>,
    admit: (recorded: BotActionType[]) => void = admitFirstAnswer,
  ): Promise<{ message: MessageView; written: T | null }> {
    const request = await this.requests.lockForAction(requestId);
    const recorded = await this.requests.findActions(request.id);
    const existing = recorded.find(
      (action) => action.actionType === actionType,
    );
    if (existing) {
      return {
        message: await this.messages.viewById(existing.messageId),
        written: null,
      };
    }
    admit(recorded.map((action) => action.actionType));
    const written = await write(request);
    await this.requests.recordAction(
      request.id,
      actionType,
      written.message.id,
    );
    return { message: written.message, written };
  }
}

// O Pedido já respondido por outra ação não aceita mais uma: uma resposta por Pedido.
function admitFirstAnswer(recorded: BotActionType[]): void {
  if (recorded.length > 0) throw new RequestClosedError();
}

// A entrega e a falha do Relatório só valem depois do Aviso de início, e só uma delas (spec da F14,
// "Ações de bot do Relatório").
function admitReportOutcome(recorded: BotActionType[]): void {
  if (!recorded.includes('report_started')) throw new ReportNotStartedError();
  if (recorded.some((type) => REPORT_TERMINAL_ACTIONS.includes(type))) {
    throw new RequestClosedError();
  }
}
