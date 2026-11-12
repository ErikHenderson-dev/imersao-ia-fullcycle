import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsModule } from '../bots/bots.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { PeopleModule } from '../people/people.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { Task } from './task.entity';
import { TaskStatusService } from './task-status.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  // Registra a entidade no autoLoadEntities; o service usa o TransactionHost.
  imports: [
    TypeOrmModule.forFeature([Task]),
    BotsModule,
    ConversationsModule,
    MessagesModule,
    PeopleModule,
    RealtimeModule,
    SessionsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskStatusService],
  exports: [TasksService],
})
export class TasksModule {}
