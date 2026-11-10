import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivityPublisher } from './activity.publisher';
import { NotificationFinder } from './notification-finder';

// As Notificações calculadas e a publicação dos números de Atividade (spec da F08; ADR 0027). Fica
// fora do módulo de Atividade para o de Mensagens publicar por ele sem ciclo: a Atividade monta os
// itens com as Mensagens.
@Module({
  imports: [RealtimeModule],
  providers: [NotificationFinder, ActivityPublisher],
  exports: [NotificationFinder, ActivityPublisher],
})
export class NotificationsModule {}
