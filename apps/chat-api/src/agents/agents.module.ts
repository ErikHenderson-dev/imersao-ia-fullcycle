import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [SessionsModule, RealtimeModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
