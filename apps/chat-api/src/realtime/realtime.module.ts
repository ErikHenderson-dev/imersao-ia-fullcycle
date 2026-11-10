import { PresenceModule } from '../presence/presence.module';
import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { SessionsModule } from '../sessions/sessions.module';
import { EventsStore } from './events.store';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher } from './realtime.publisher';

@Module({
  imports: [SessionsModule, ConversationsModule, PresenceModule],
  providers: [RealtimeGateway, RealtimePublisher, EventsStore],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
