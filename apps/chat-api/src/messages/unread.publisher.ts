import { Injectable, Logger } from '@nestjs/common';
import { KeyedSerialQueue } from '../common/queue/keyed-serial-queue';
import { toUnreadResponse } from '../conversations/conversation.response';
import { memberKey, UnreadCounter } from '../conversations/unread-counter';
import { RealtimePublisher } from '../realtime/realtime.publisher';

// As Pessoas que recebem os números: já sabidas, ou lidas na vez da publicação.
export type UnreadRecipients = string[] | (() => Promise<string[]>);

// Publica os números de Não lidas e de Menções das Pessoas afetadas por uma mudança (spec da F07,
// "Tempo real"). Os números são contados na vez de cada publicação, numa fila em memória por
// Conversa: os eventos de uma Conversa saem um depois do outro, e cada um reflete o banco no
// momento em que sai, então o último que a aba recebe é o mais novo. As publicações que esperam a
// vez na mesma Conversa se juntam numa só, com todas as Pessoas: contar uma vez, na vez dela, dá o
// mesmo que contar para cada uma. Vale para uma instância da API, como a fila por Mensagem. A falha
// só vai para o log (LLD, "Transações").
@Injectable()
export class UnreadPublisher {
  private readonly logger = new Logger(UnreadPublisher.name);
  private readonly queue = new KeyedSerialQueue();
  // As publicações que ainda esperam a vez, por Conversa.
  private readonly waiting = new Map<string, UnreadRecipients[]>();

  constructor(
    private readonly unreadCounter: UnreadCounter,
    private readonly publisher: RealtimePublisher,
  ) {}

  publish(conversationId: string, recipients: UnreadRecipients): void {
    const waiting = this.waiting.get(conversationId);
    if (waiting) {
      waiting.push(recipients);
      return;
    }
    const batch = [recipients];
    this.waiting.set(conversationId, batch);
    void this.queue.run(conversationId, async () => {
      this.waiting.delete(conversationId);
      try {
        await this.countAndPublish(conversationId, batch);
      } catch (error) {
        this.logger.error('Falha ao publicar as Não lidas', error);
      }
    });
  }

  private async countAndPublish(
    conversationId: string,
    batch: UnreadRecipients[],
  ): Promise<void> {
    const resolved = await Promise.all(
      batch.map((recipients) =>
        typeof recipients === 'function'
          ? recipients()
          : Promise.resolve(recipients),
      ),
    );
    const personIds = [...new Set(resolved.flat())];
    if (personIds.length === 0) return;
    const counts = await this.unreadCounter.countFor(
      personIds.map((personId) => ({ conversationId, personId })),
    );
    // Quem deixou de ser Membro no meio fica fora: não há contagem para ele.
    const reachable = personIds.filter((personId) =>
      counts.has(memberKey({ conversationId, personId })),
    );
    await this.publisher.conversationUnread(reachable, (personId) => ({
      conversation_id: conversationId,
      ...toUnreadResponse(counts.get(memberKey({ conversationId, personId }))!),
    }));
  }
}
