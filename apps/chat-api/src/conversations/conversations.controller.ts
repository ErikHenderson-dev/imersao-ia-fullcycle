import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { PersonSummary } from '../people/person-summary';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import {
  ConversationResponse,
  ListedConversationResponse,
  toConversationResponse,
  toListedConversationResponse,
} from './conversation.response';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  async list(
    @CurrentPerson() person: Person,
  ): Promise<{ conversations: ListedConversationResponse[] }> {
    const summaries = await this.conversations.listSummariesForMember(
      person.id,
    );
    return {
      conversations: summaries.map((summary) =>
        toListedConversationResponse(summary, person.id),
      ),
    };
  }

  @Get(':id/members')
  async members(
    @CurrentPerson() person: Person,
    @Param('id') id: string,
  ): Promise<{ members: PersonSummary[] }> {
    return { members: await this.conversations.listMembers(person.id, id) };
  }

  @Get(':id')
  async get(
    @CurrentPerson() person: Person,
    @Param('id') id: string,
  ): Promise<{ conversation: ConversationResponse }> {
    const conversation = await this.conversations.getForMember(person.id, id);
    const [summary] = await this.conversations.withMemberCounts([conversation]);
    return { conversation: toConversationResponse(summary, person.id) };
  }
}
