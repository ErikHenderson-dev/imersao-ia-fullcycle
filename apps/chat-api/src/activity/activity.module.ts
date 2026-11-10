import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { NotificationsModule } from '../notifications/notifications.module';

// A Atividade: as Notificações calculadas e os números (spec da F08; ADR 0027).
@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    NotificationsModule,
    SessionsModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
