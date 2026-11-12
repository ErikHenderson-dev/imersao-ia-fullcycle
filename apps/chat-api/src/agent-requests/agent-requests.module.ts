import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsModule } from '../sessions/sessions.module';
import { AgentRequest } from './agent-request.entity';
import { AgentRequestsController } from './agent-requests.controller';
import { AgentRequestsService } from './agent-requests.service';
import { BotAction } from './bot-action.entity';
import { PendingQuestion } from './pending-question.entity';
import { PendingQuestionsService } from './pending-questions.service';

@Module({
  // Registra as entidades no autoLoadEntities; o service usa o TransactionHost. O SessionsModule
  // dá o AuthGuard do encerramento pelo BFF.
  imports: [
    TypeOrmModule.forFeature([AgentRequest, BotAction, PendingQuestion]),
    SessionsModule,
  ],
  controllers: [AgentRequestsController],
  providers: [AgentRequestsService, PendingQuestionsService],
  exports: [AgentRequestsService, PendingQuestionsService],
})
export class AgentRequestsModule {}
