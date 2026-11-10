import {
  Body,
  Controller,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { ReadConversationDto } from './read-conversation.dto';
import { ReadService } from './read.service';

// A leitura de uma Conversa (spec da F07, "Rotas").
@Controller('conversations/:conversationId/read')
@UseGuards(AuthGuard)
export class ReadController {
  constructor(private readonly reads: ReadService) {}

  @Put()
  @HttpCode(200)
  async read(
    @CurrentPerson() person: Person,
    @Param('conversationId') conversationId: string,
    @Body() body: ReadConversationDto,
  ): Promise<{
    conversation_id: string;
    last_read_message_id: string | null;
    unread_count: number;
    mention_count: number;
  }> {
    const unread = await this.reads.markRead(
      person.id,
      conversationId,
      body.message_id,
    );
    return {
      conversation_id: conversationId,
      last_read_message_id: unread.lastReadMessageId,
      unread_count: unread.unreadCount,
      mention_count: unread.mentionCount,
    };
  }
}
