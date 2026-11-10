import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleModule } from '../people/people.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ConversationMember } from './conversation-member.entity';
import { Conversation } from './conversation.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { UnreadCounter } from './unread-counter';

@Module({
  // O forFeature registra as entidades no autoLoadEntities; o service usa o TransactionHost.
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMember]),
    PeopleModule,
    SessionsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, UnreadCounter],
  exports: [ConversationsService],
})
export class ConversationsModule {}
