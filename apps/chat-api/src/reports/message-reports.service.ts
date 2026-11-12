import { Inject, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ConversationsService } from '../conversations/conversations.service';
import { ConversationNotFoundError } from '../conversations/conversation-not-found.error';
import { MessageNotFoundError } from '../messages/message-not-found.error';
import { MessagesService } from '../messages/messages.service';
import { DataAccessRequiredError } from './data-access-required.error';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage';
import { REPORT_URL_TTL_SECONDS } from './report-values';

// O download do PDF do Relatório (spec da F14, "Referência ao PDF e download"): só para Membro da
// Conversa da Mensagem, com a Permissão de dados lida no momento do pedido.
@Injectable()
export class MessageReportsService {
  constructor(
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  // A URL assinada do PDF. Quem não é Membro, a Mensagem apagada e a sem relatório recebem o mesmo
  // `message_not_found`, antes da Permissão de dados: quem não é Membro não descobre o relatório.
  async downloadUrl(
    reader: { id: string; dataAccess: boolean },
    messageId: string,
  ): Promise<string> {
    if (!isUUID(messageId)) throw new MessageNotFoundError();
    const report = await this.messages.findReport(messageId);
    if (!report) throw new MessageNotFoundError();
    await this.conversations
      .getForMember(reader.id, report.conversationId)
      .catch((error: unknown) => {
        throw error instanceof ConversationNotFoundError
          ? new MessageNotFoundError()
          : error;
      });
    if (!reader.dataAccess) throw new DataAccessRequiredError();
    return this.storage.downloadUrl(report.storageKey, {
      fileName: report.fileName,
      contentType: 'application/pdf',
      expiresInSeconds: REPORT_URL_TTL_SECONDS,
    });
  }
}
