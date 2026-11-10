import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { Unread, UnreadCounter } from '../conversations/unread-counter';
import { Message } from './message.entity';
import { ActivityPublisher } from '../notifications/activity.publisher';
import { MessageNotFoundError } from './message-not-found.error';
import { UnreadPublisher } from './unread.publisher';

// Ler a Conversa (spec da F07, "Avançar a Última leitura"): a Mensagem é só uma posição, então
// vale a apagada, desde que seja desta Conversa.
@Injectable()
export class ReadService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly conversations: ConversationsService,
    private readonly unreadCounter: UnreadCounter,
    private readonly unreadPublisher: UnreadPublisher,
    private readonly activityPublisher: ActivityPublisher,
  ) {}

  // Avança a Última leitura só para frente e devolve a posição e os números atuais: uma posição
  // igual ou anterior não grava nada, e responde como está (LLD, "Concorrência e idempotência").
  async markRead(
    personId: string,
    conversationId: string,
    messageId: string,
  ): Promise<Unread> {
    const conversation = await this.conversations.getForMember(
      personId,
      conversationId,
    );
    const isFromConversation = await this.txHost.tx
      .getRepository(Message)
      .existsBy({ id: messageId, conversationId: conversation.id });
    if (!isFromConversation) throw new MessageNotFoundError();
    const advanced = await this.conversations.advanceLastRead(
      conversation.id,
      personId,
      messageId,
    );
    // As outras abas de quem leu recebem os números, sem segurar a resposta (spec da F07).
    if (advanced) {
      this.unreadPublisher.publish(conversation.id, [personId]);
      // A leitura também lê as Notificações da Conversa (spec da F08, "Tempo real").
      this.activityPublisher.publish([personId]);
    }
    return this.unreadCounter.countOne({
      conversationId: conversation.id,
      personId,
    });
  }
}
