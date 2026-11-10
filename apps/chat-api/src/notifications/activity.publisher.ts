import { Injectable, Logger } from '@nestjs/common';
import { KeyedSerialQueue } from '../common/queue/keyed-serial-queue';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { NotificationFinder } from './notification-finder';

// As Pessoas que recebem os números: já sabidas, ou lidas na vez da publicação.
export type ActivityRecipients = string[] | (() => Promise<string[]>);

// Publica os números de Atividade das Pessoas afetadas por uma mudança (spec da F08, "Tempo real").
// Os números dependem de várias Conversas, então a fila é por Pessoa: os eventos de uma Pessoa saem
// um depois do outro, cada um contado na vez dele, e o último que a aba recebe é o mais novo. As
// publicações que esperam a vez da mesma Pessoa se juntam numa só. Vale para uma instância da API,
// como as filas da F06 e da F07. A falha só vai para o log (LLD, "Transações").
@Injectable()
export class ActivityPublisher {
  private readonly logger = new Logger(ActivityPublisher.name);
  private readonly queue = new KeyedSerialQueue();
  // As Pessoas que já têm uma publicação esperando a vez.
  private readonly waiting = new Set<string>();

  constructor(
    private readonly notifications: NotificationFinder,
    private readonly publisher: RealtimePublisher,
  ) {}

  publish(recipients: ActivityRecipients): void {
    const resolved =
      typeof recipients === 'function'
        ? recipients()
        : Promise.resolve(recipients);
    void resolved
      .then((personIds) => new Set(personIds).forEach((id) => this.enqueue(id)))
      .catch((error: unknown) =>
        this.logger.error('Falha ao publicar a Atividade', error),
      );
  }

  private enqueue(personId: string): void {
    if (this.waiting.has(personId)) return;
    this.waiting.add(personId);
    void this.queue.run(personId, async () => {
      this.waiting.delete(personId);
      try {
        const counts = await this.notifications.countOne(personId);
        await this.publisher.activityUnread([personId], () => ({
          total_count: counts.totalCount,
          mention_count: counts.mentionCount,
          direct_count: counts.directCount,
        }));
      } catch (error) {
        this.logger.error('Falha ao publicar a Atividade', error);
      }
    });
  }
}
