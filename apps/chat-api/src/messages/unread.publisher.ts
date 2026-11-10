import { Injectable, Logger } from '@nestjs/common';
import { toUnreadResponse } from '../conversations/conversation.response';
import { memberKey, UnreadCounter } from '../conversations/unread-counter';
import { RealtimePublisher } from '../realtime/realtime.publisher';

// Publica os números de Não lidas e de Menções das Pessoas afetadas por uma mudança (spec da F07,
// "Tempo real"). Os números são contados na vez de cada publicação, numa fila em memória por
// Conversa: os eventos de uma Conversa saem um depois do outro, e cada um reflete o banco no
// momento em que sai, então o último que a aba recebe é o mais novo. Vale para uma instância da
// API, como a fila por Mensagem. A falha só vai para o log (LLD, "Transações").
@Injectable()
export class UnreadPublisher {
  private readonly logger = new Logger(UnreadPublisher.name);
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    private readonly unreadCounter: UnreadCounter,
    private readonly publisher: RealtimePublisher,
  ) {}

  // Enfileira a publicação para as Pessoas; devolve quando ela termina, sem nunca rejeitar.
  publish(conversationId: string, personIds: string[]): Promise<void> {
    if (personIds.length === 0) return Promise.resolve();
    const previous = this.queues.get(conversationId) ?? Promise.resolve();
    const next = previous.then(() =>
      this.countAndPublish(conversationId, personIds).catch((error: unknown) =>
        this.logger.error('Falha ao publicar as Não lidas', error),
      ),
    );
    this.queues.set(conversationId, next);
    void next.finally(() => {
      if (this.queues.get(conversationId) === next) {
        this.queues.delete(conversationId);
      }
    });
    return next;
  }

  private async countAndPublish(
    conversationId: string,
    personIds: string[],
  ): Promise<void> {
    const counts = await this.unreadCounter.countFor(
      personIds.map((personId) => ({ conversationId, personId })),
    );
    // Quem deixou de ser Membro no meio fica fora: não há contagem para ele.
    const perPerson = new Map(
      personIds.flatMap((personId) => {
        const unread = counts.get(memberKey({ conversationId, personId }));
        return unread
          ? [
              [
                personId,
                {
                  conversation_id: conversationId,
                  ...toUnreadResponse(unread),
                },
              ] as const,
            ]
          : [];
      }),
    );
    await this.publisher.conversationUnread(perPerson);
  }
}
