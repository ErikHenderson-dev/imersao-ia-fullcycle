import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  BOT_READER,
  MessageResponse,
  toMessageResponse,
} from '../messages/message.response';
import { BotActionsService } from './bot-actions.service';
import { BotOrWorkerTokenGuard } from './bot-or-worker-token.guard';
import { BotTokenGuard } from './bot-token.guard';
import { ReportStartedDto } from './report-started.dto';

// As ações de bot do Relatório, sob o Pedido, cada uma com a credencial que aceita (spec da F14,
// "Ações de bot do Relatório").
@Controller('bot/requests/:requestId')
export class BotReportsController {
  constructor(private readonly actions: BotActionsService) {}

  @Post('report-started')
  @UseGuards(BotTokenGuard)
  async reportStarted(
    @Param('requestId') requestId: string,
    @Body() body: ReportStartedDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.reportStarted(requestId, body.body);
    return { message: toMessageResponse(message, BOT_READER) };
  }

  @Post('report-failed')
  @UseGuards(BotOrWorkerTokenGuard)
  async reportFailed(
    @Param('requestId') requestId: string,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.reportFailed(requestId);
    return { message: toMessageResponse(message, BOT_READER) };
  }
}
