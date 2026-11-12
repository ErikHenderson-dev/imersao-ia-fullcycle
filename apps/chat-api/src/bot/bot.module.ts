import { Module } from '@nestjs/common';
import { AgentRequestsModule } from '../agent-requests/agent-requests.module';
import { BotsModule } from '../bots/bots.module';
import { MessagesModule } from '../messages/messages.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PeopleModule } from '../people/people.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { BotActionsService } from './bot-actions.service';
import { BotController } from './bot.controller';
import { BotOrWorkerTokenGuard } from './bot-or-worker-token.guard';
import { BotReportsController } from './bot-reports.controller';
import { BotTokenGuard } from './bot-token.guard';

@Module({
  imports: [
    AgentRequestsModule,
    BotsModule,
    MessagesModule,
    RealtimeModule,
    TasksModule,
    NotificationsModule,
    PeopleModule,
  ],
  controllers: [BotController, BotReportsController],
  providers: [BotActionsService, BotTokenGuard, BotOrWorkerTokenGuard],
})
export class BotModule {}
