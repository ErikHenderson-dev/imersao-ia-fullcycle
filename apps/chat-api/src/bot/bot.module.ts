import { Module } from '@nestjs/common';
import { AgentRequestsModule } from '../agent-requests/agent-requests.module';
import { BotsModule } from '../bots/bots.module';
import { MessagesModule } from '../messages/messages.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TasksModule } from '../tasks/tasks.module';
import { BotActionsService } from './bot-actions.service';
import { BotController } from './bot.controller';
import { BotTokenGuard } from './bot-token.guard';

@Module({
  imports: [
    AgentRequestsModule,
    BotsModule,
    MessagesModule,
    RealtimeModule,
    TasksModule,
  ],
  controllers: [BotController],
  providers: [BotActionsService, BotTokenGuard],
})
export class BotModule {}
