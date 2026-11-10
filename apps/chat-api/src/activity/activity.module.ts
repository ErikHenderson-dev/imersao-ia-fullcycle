import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { NotificationFinder } from './notification-finder';

// A Atividade: as Notificações calculadas e os números (spec da F08; ADR 0027).
@Module({
  imports: [ConversationsModule, MessagesModule, SessionsModule],
  controllers: [ActivityController],
  providers: [ActivityService, NotificationFinder],
  exports: [NotificationFinder],
})
export class ActivityModule {}
