import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { PeopleModule } from '../people/people.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [ConversationsModule, PeopleModule, RealtimeModule, SessionsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
