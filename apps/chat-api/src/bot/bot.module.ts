import { Module } from '@nestjs/common';
import { AgentRequestsModule } from '../agent-requests/agent-requests.module';
import { MessagesModule } from '../messages/messages.module';
import { BotActionsService } from './bot-actions.service';
import { BotController } from './bot.controller';
import { BotTokenGuard } from './bot-token.guard';

@Module({
  imports: [AgentRequestsModule, MessagesModule],
  controllers: [BotController],
  providers: [BotActionsService, BotTokenGuard],
})
export class BotModule {}
