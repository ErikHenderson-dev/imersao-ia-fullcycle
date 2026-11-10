import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { EditMessageDto } from './edit-message.dto';
import { ListMessagesQuery } from './list-messages.query';
import { MessageResponse, toMessageResponse } from './message.response';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './send-message.dto';

@Controller('conversations/:conversationId/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  async list(
    @CurrentPerson() person: Person,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQuery,
  ): Promise<{ messages: MessageResponse[]; has_more: boolean }> {
    const page = await this.messages.listPage(person.id, conversationId, query);
    return {
      messages: page.messages.map(toMessageResponse),
      has_more: page.hasMore,
    };
  }

  @Post()
  async send(
    @CurrentPerson() person: Person,
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.messages.sendMessage(
      { id: person.id, name: person.name },
      conversationId,
      { clientId: body.client_id, body: body.body },
    );
    return { message: toMessageResponse(message) };
  }

  // Edita a própria Mensagem (spec da F06, "Rotas").
  @Patch(':id')
  async edit(
    @CurrentPerson() person: Person,
    @Param('conversationId') conversationId: string,
    @Param('id') id: string,
    @Body() body: EditMessageDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.messages.editMessage(
      person.id,
      conversationId,
      id,
      body.body,
    );
    return { message: toMessageResponse(message) };
  }
}
