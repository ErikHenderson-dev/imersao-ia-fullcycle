import { Injectable, Logger } from '@nestjs/common';
import type {
  ConversationPayload,
  MessagePayload,
  StoredEventName,
  StoredEventPayloads,
} from 'chat-events';
import { EventsStore } from './events.store';
import { RealtimeGateway } from './realtime.gateway';
import { emitStoredEvent, personRoom } from './realtime-socket';

// Emite os eventos guardados por Pessoa para as abas dela (spec da F03, "Eventos por Pessoa e
// reconexão"). Quem chama publica depois da gravação. Cada evento entra antes no stream de cada
// Pessoa, e cada sala recebe o cursor da sua; com o Redis fora, o evento sai sem cursor, e a
// reconexão seguinte das Pessoas afetadas recarrega.
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly events: EventsStore,
  ) {}

  messageCreated(memberIds: string[], message: MessagePayload): Promise<void> {
    return this.publish('message.created', memberIds, { message });
  }

  // A Mensagem apagada, pelo id, para os Membros (spec da F06, "Tempo real").
  messageDeleted(
    memberIds: string[],
    event: StoredEventPayloads['message.deleted'],
  ): Promise<void> {
    return this.publish('message.deleted', memberIds, event);
  }

  // A Mensagem editada, inteira, para os Membros (spec da F06, "Tempo real").
  messageUpdated(memberIds: string[], message: MessagePayload): Promise<void> {
    return this.publish('message.updated', memberIds, { message });
  }

  // Pessoas que entraram numa Conversa: vai para todos os Membros dela depois da gravação (spec da
  // F04, "Tempo real"). Quem entrou agora recebe person_ids só com ela mesma; quem já era Membro
  // recebe as Pessoas adicionadas. Assim o Canal público novo não leva o workspace inteiro em cada
  // um dos eventos guardados.
  // A Conversa vai montada para cada Membro: a outra Pessoa da Conversa direta depende de quem
  // recebe (spec da F05, "Tempo real").
  memberAdded(
    memberIds: string[],
    conversationFor: (personId: string) => ConversationPayload,
    addedIds: string[],
  ): Promise<void> {
    const added = new Set(addedIds);
    return this.publish('conversation.member_added', memberIds, (personId) => ({
      conversation: conversationFor(personId),
      person_ids: added.has(personId) ? [personId] : addedIds,
    }));
  }

  // Os números de cada Pessoa numa Conversa, montados para ela (spec da F07, "Tempo real").
  conversationUnread(
    perPerson: Map<string, StoredEventPayloads['conversation.unread']>,
  ): Promise<void> {
    return this.publish(
      'conversation.unread',
      [...perPerson.keys()],
      (personId) => perPerson.get(personId)!,
    );
  }

  private async publish<N extends StoredEventName>(
    name: N,
    memberIds: string[],
    // A carga, a mesma para todos os Membros, ou montada para cada um.
    payload:
      StoredEventPayloads[N] | ((personId: string) => StoredEventPayloads[N]),
  ): Promise<void> {
    if (memberIds.length === 0) return;
    // A carga de cada Pessoa é montada uma vez só, para o stream e para a emissão.
    const built =
      typeof payload === 'function'
        ? new Map(memberIds.map((personId) => [personId, payload(personId)]))
        : null;
    const payloadFor = (personId: string): StoredEventPayloads[N] =>
      built ? built.get(personId)! : (payload as StoredEventPayloads[N]);
    let cursors: Map<string, string>;
    try {
      cursors = await this.events.append(
        memberIds,
        typeof payload === 'function'
          ? (personId) => ({ name, payload: payloadFor(personId) })
          : { name, payload },
      );
    } catch (error) {
      this.logger.error('Falha ao guardar o evento no Redis', error);
      this.events.markMissed(memberIds);
      if (typeof payload === 'function') {
        for (const personId of memberIds) {
          emitStoredEvent(
            this.to(personRoom(personId)),
            name,
            payloadFor(personId),
          );
        }
      } else {
        emitStoredEvent(this.to(memberIds.map(personRoom)), name, payload);
      }
      return;
    }
    for (const personId of memberIds) {
      emitStoredEvent(this.to(personRoom(personId)), name, {
        event_id: cursors.get(personId),
        ...payloadFor(personId),
      });
    }
  }

  private to(rooms: string | string[]) {
    return this.gateway.server.to(rooms);
  }
}
