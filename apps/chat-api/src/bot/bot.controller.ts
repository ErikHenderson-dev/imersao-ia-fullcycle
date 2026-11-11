import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  MessageResponse,
  toMessageResponse,
} from '../messages/message.response';
import { BotActionsService } from './bot-actions.service';
import { BotMessagesQuery } from './bot-messages.query';
import {
  BotMessagesResponse,
  toBotMessagesResponse,
} from './bot-messages.response';
import { BotTokenGuard } from './bot-token.guard';
import { ReplyDto } from './reply.dto';

// As rotas do bot, sob o Pedido e com a credencial de bot (spec da F11, "Rotas do bot e
// credencial").
@Controller('bot/requests/:requestId')
@UseGuards(BotTokenGuard)
export class BotController {
  constructor(private readonly actions: BotActionsService) {}

  @Get('messages')
  async messages(
    @Param('requestId') requestId: string,
    @Query() query: BotMessagesQuery,
  ): Promise<BotMessagesResponse> {
    const page = await this.actions.readMessages(requestId, {
      since: query.since ? new Date(query.since) : undefined,
      until: query.until ? new Date(query.until) : undefined,
      authorUsername: query.author_username,
    });
    return toBotMessagesResponse(page);
  }

  @Post('reply')
  async reply(
    @Param('requestId') requestId: string,
    @Body() body: ReplyDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.reply(requestId, body.body);
    return { message: toMessageResponse(message) };
  }
}
