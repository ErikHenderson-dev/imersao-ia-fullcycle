import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../messages/message.entity';
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
    // Message: a participação aponta para a Última leitura (spec da F07); sem ela registrada, um
    // módulo que importa só este não monta os metadados da relação.
    TypeOrmModule.forFeature([Conversation, ConversationMember, Message]),
    PeopleModule,
    SessionsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, UnreadCounter],
  exports: [ConversationsService, UnreadCounter],
})
export class ConversationsModule {}
