import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { Unread, UnreadCounter } from '../conversations/unread-counter';
import { Message } from './message.entity';
import { MessageNotFoundError } from './message-not-found.error';

// Ler a Conversa (spec da F07, "Avançar a Última leitura"): a Mensagem é só uma posição, então
// vale a apagada, desde que seja desta Conversa.
@Injectable()
export class ReadService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly conversations: ConversationsService,
    private readonly unreadCounter: UnreadCounter,
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
    await this.conversations.advanceLastRead(
      conversation.id,
      personId,
      messageId,
    );
    return this.unreadCounter.countOne({
      conversationId: conversation.id,
      personId,
    });
  }
}
