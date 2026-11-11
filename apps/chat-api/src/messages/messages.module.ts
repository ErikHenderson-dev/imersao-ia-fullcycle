import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsModule } from '../bots/bots.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeopleModule } from '../people/people.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { Message } from './message.entity';
import { MessageMention } from './message-mention.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ReadController } from './read.controller';
import { ReadService } from './read.service';
import { UnreadPublisher } from './unread.publisher';

@Module({
  // O forFeature registra a entidade no autoLoadEntities; o service usa o TransactionHost.
  imports: [
    TypeOrmModule.forFeature([Message, MessageMention]),
    ConversationsModule,
    PeopleModule,
    BotsModule,
    SessionsModule,
    RealtimeModule,
    MembershipsModule,
    NotificationsModule,
  ],
  controllers: [MessagesController, ReadController],
  providers: [MessagesService, ReadService, UnreadPublisher],
  // A Atividade monta a Mensagem dos itens como o histórico (spec da F08).
  exports: [MessagesService],
})
export class MessagesModule {}
