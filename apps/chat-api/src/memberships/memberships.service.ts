import { Injectable, Logger } from '@nestjs/common';
import { toConversationResponse } from '../conversations/conversation.response';
import type {
  ConversationSummary,
  NewChannel,
  OpenedDirectConversation,
} from '../conversations/conversations.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PeopleService } from '../people/people.service';
import { PersonSummary, sortedSummaries } from '../people/person-summary';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { PEOPLE_SEARCH_LIMIT } from './membership-values';

export interface AddedMembers {
  addedIds: string[];
  memberCount: number;
}

// Mudanças de participação que viram evento do tempo real (spec da F04, "Tempo real"): grava pelo
// service de Conversas, que é a transação, e só depois publica conversation.member_added para os
// Membros. Fica fora do módulo de Conversas porque o tempo real depende dele.
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly people: PeopleService,
    private readonly publisher: RealtimePublisher,
  ) {}

  // Pessoas para adicionar a uma Conversa de que quem busca é Membro, sem os Membros dela, em ordem
  // alfabética (spec da F04, "Busca de Pessoas").
  async searchPeople(
    personId: string,
    conversationId: string,
    q: string,
  ): Promise<PersonSummary[]> {
    await this.conversations.getForMember(personId, conversationId);
    const memberIds = await this.conversations.listMemberIds(conversationId);
    const people = await this.people.search(
      q.trim(),
      memberIds,
      PEOPLE_SEARCH_LIMIT,
    );
    return sortedSummaries(people);
  }

  // Adiciona Pessoas ao Canal privado e, se alguma entrou agora, avisa os Membros antigos e novos.
  async addMembers(
    personId: string,
    conversationId: string,
    personIds: string[],
  ): Promise<AddedMembers> {
    const { summary, addedIds, memberIds } =
      await this.conversations.addMembers(personId, conversationId, personIds);
    if (addedIds.length > 0) {
      void this.announceMemberAdded(summary, memberIds, addedIds);
    }
    return { addedIds, memberCount: summary.memberCount };
  }

  // Cria o Canal e, só quando ele foi criado agora, avisa os Membros: todos eles entraram agora. O
  // reenvio do mesmo client_id não publica de novo.
  async createChannel(
    creatorId: string,
    newChannel: NewChannel,
  ): Promise<ConversationSummary> {
    const { created, memberIds, ...summary } =
      await this.conversations.createChannel(creatorId, newChannel);
    if (created) void this.announceMemberAdded(summary, memberIds, memberIds);
    return summary;
  }

  // Abre a Conversa direta e, só quando quem abriu virou Membro agora, avisa os Membros dela: as
  // outras abas de quem abriu e, se ela já abriu antes, a outra Pessoa (spec da F05, "Tempo real").
  async openDirectConversation(
    openerId: string,
    personId: string,
  ): Promise<OpenedDirectConversation> {
    const opened = await this.conversations.openDirectConversation(
      openerId,
      personId,
    );
    if (opened.joined)
      void this.announceMemberAdded(opened, opened.memberIds, [openerId]);
    return opened;
  }

  // Publica sem prender a resposta: a gravação já aconteceu, e a falha vai para o log, como no envio
  // de Mensagem. Devolve a promessa, que nunca rejeita, para o envio de Mensagem esperar por ela
  // antes de publicar a Mensagem (spec da F05, "Tempo real", "Ordem").
  announceMemberAdded(
    summary: ConversationSummary,
    memberIds: string[],
    addedIds: string[],
  ): Promise<void> {
    return this.publisher
      .memberAdded(
        memberIds,
        // Só a Conversa direta muda de quem recebe para quem recebe; a do Canal é montada uma vez.
        summary.conversation.kind === 'direct'
          ? (personId) => toConversationResponse(summary, personId)
          : constant(toConversationResponse(summary, '')),
        addedIds,
      )
      .catch((error: unknown) =>
        this.logger.error('Falha ao publicar a participação gravada', error),
      );
  }
}

function constant<T>(value: T): () => T {
  return () => value;
}
