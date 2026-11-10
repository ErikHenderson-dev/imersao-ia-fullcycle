import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsModule } from '../conversations/conversations.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { PeopleModule } from '../people/people.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { Message } from './message.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  // O forFeature registra a entidade no autoLoadEntities; o service usa o TransactionHost.
  imports: [
    TypeOrmModule.forFeature([Message]),
    ConversationsModule,
    PeopleModule,
    SessionsModule,
    RealtimeModule,
    MembershipsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
