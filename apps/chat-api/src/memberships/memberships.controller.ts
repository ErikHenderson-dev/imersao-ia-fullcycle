import type { Presence } from 'chat-events';
import { PresenceTracker, withPresence } from '../presence/presence-tracker';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConversationResponse,
  toConversationResponse,
} from '../conversations/conversation.response';
import { CreateConversationDto } from '../conversations/create-conversation.dto';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { AddMembersDto } from './add-members.dto';
import type { PersonSummary } from '../people/person-summary';
import { MembershipsService } from './memberships.service';
import { SearchPeopleQuery } from './search-people.query';

// As rotas que mudam quem é Membro de uma Conversa e avisam pelo tempo real, e a busca de quem
// adicionar (spec da F04, "Rotas").
@Controller()
@UseGuards(AuthGuard)
export class MembershipsController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly presence: PresenceTracker,
  ) {}

  // Cria um Canal (F04) ou abre a Conversa direta com uma Pessoa (F05): 201 quando a Conversa
  // nasceu agora, 200 quando a Conversa direta do par já existia.
  @Post('conversations')
  async create(
    @CurrentPerson() person: Person,
    @Body() body: CreateConversationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ conversation: ConversationResponse }> {
    if (body.kind === 'direct') {
      const opened = await this.memberships.openDirectConversation(
        person.id,
        body.person_id!,
      );
      if (!opened.created) response.status(200);
      return { conversation: toConversationResponse(opened, person.id) };
    }
    const created = await this.memberships.createChannel(person.id, {
      kind: body.kind,
      name: body.name!,
      topic: body.topic,
      clientId: body.client_id!,
    });
    return { conversation: toConversationResponse(created, person.id) };
  }

  @Post('conversations/:id/members')
  @HttpCode(200)
  async addMembers(
    @CurrentPerson() person: Person,
    @Param('id') id: string,
    @Body() body: AddMembersDto,
  ): Promise<{ added_person_ids: string[]; member_count: number }> {
    const added = await this.memberships.addMembers(
      person.id,
      id,
      body.person_ids,
    );
    return {
      added_person_ids: added.addedIds,
      member_count: added.memberCount,
    };
  }

  @Get('people')
  async searchPeople(
    @CurrentPerson() person: Person,
    @Query() query: SearchPeopleQuery,
  ): Promise<{ people: (PersonSummary & { presence: Presence })[] }> {
    const people = await this.memberships.searchPeople(
      person.id,
      {
        notMemberOf: query.not_member_of,
        memberOf: query.member_of,
        onlyAdmins: query.admin === 'true',
      },
      query.q ?? '',
    );
    return { people: withPresence(this.presence, people) };
  }
}
