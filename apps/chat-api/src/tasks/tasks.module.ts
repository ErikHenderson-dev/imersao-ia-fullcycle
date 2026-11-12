import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsModule } from '../bots/bots.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { PeopleModule } from '../people/people.module';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

@Module({
  // Registra a entidade no autoLoadEntities; o service usa o TransactionHost.
  imports: [
    TypeOrmModule.forFeature([Task]),
    BotsModule,
    ConversationsModule,
    MessagesModule,
    PeopleModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
