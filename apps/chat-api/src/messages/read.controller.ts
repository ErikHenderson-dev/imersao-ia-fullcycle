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
import {
  toUnreadResponse,
  UnreadResponse,
} from '../conversations/conversation.response';
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
  ): Promise<{ conversation_id: string } & UnreadResponse> {
    const unread = await this.reads.markRead(
      person.id,
      conversationId,
      body.message_id,
    );
    return { conversation_id: conversationId, ...toUnreadResponse(unread) };
  }
}
