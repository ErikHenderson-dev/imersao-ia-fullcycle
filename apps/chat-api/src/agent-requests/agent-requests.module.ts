import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsModule } from '../sessions/sessions.module';
import { AgentRequest } from './agent-request.entity';
import { AgentRequestsController } from './agent-requests.controller';
import { AgentRequestsService } from './agent-requests.service';
import { BotAction } from './bot-action.entity';

@Module({
  // Registra as entidades no autoLoadEntities; o service usa o TransactionHost. O SessionsModule
  // dá o AuthGuard do encerramento pelo BFF.
  imports: [
    TypeOrmModule.forFeature([AgentRequest, BotAction]),
    SessionsModule,
  ],
  controllers: [AgentRequestsController],
  providers: [AgentRequestsService],
  exports: [AgentRequestsService],
})
export class AgentRequestsModule {}
