import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  MessageResponse,
  toMessageResponse,
} from '../messages/message.response';
import { BotActionsService } from './bot-actions.service';
import { BotTokenGuard } from './bot-token.guard';
import { ReplyDto } from './reply.dto';

// As rotas do bot, sob o Pedido e com a credencial de bot (spec da F11, "Rotas do bot e
// credencial").
@Controller('bot/requests/:requestId')
@UseGuards(BotTokenGuard)
export class BotController {
  constructor(private readonly actions: BotActionsService) {}

  @Post('reply')
  async reply(
    @Param('requestId') requestId: string,
    @Body() body: ReplyDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.reply(requestId, body.body);
    return { message: toMessageResponse(message) };
  }
}
