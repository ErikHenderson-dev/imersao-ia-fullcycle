import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { BotCountsQuery } from './bot-counts.query';
import { BotCountsResponse, toBotCountsResponse } from './bot-counts.response';
import { BotMessagesQuery } from './bot-messages.query';
import {
  BotMessagesResponse,
  toBotMessagesResponse,
} from './bot-messages.response';
import { BotTokenGuard } from './bot-token.guard';
import { QuestionDto } from './question.dto';
import { ReplyDto } from './reply.dto';
import { TaskDto } from './task.dto';
import { TaskResponse, toTaskResponse } from '../tasks/task.response';

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

  @Get('message-counts')
  async messageCounts(
    @Param('requestId') requestId: string,
    @Query() query: BotCountsQuery,
  ): Promise<BotCountsResponse> {
    const sinces = query.since ?? [];
    const counts = await this.actions.countMessages(
      requestId,
      sinces.map((since) => new Date(since)),
      query.until ? new Date(query.until) : undefined,
    );
    return toBotCountsResponse(sinces, counts);
  }

  @Post('typing')
  @HttpCode(204)
  async typing(@Param('requestId') requestId: string): Promise<void> {
    await this.actions.typing(requestId);
  }

  @Post('reply')
  async reply(
    @Param('requestId') requestId: string,
    @Body() body: ReplyDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.reply(requestId, body.body);
    return { message: toMessageResponse(message) };
  }

  @Post('question')
  async question(
    @Param('requestId') requestId: string,
    @Body() body: QuestionDto,
  ): Promise<{ message: MessageResponse }> {
    const message = await this.actions.question(
      requestId,
      body.body,
      body.quick_replies,
    );
    return { message: toMessageResponse(message) };
  }

  @Post('task')
  async task(
    @Param('requestId') requestId: string,
    @Body() body: TaskDto,
  ): Promise<{ task: TaskResponse; message: MessageResponse }> {
    const { task, message } = await this.actions.task(
      requestId,
      body.assignee_username,
      body.title,
    );
    return { task: toTaskResponse(task), message: toMessageResponse(message) };
  }
}
