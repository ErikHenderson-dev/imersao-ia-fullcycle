import { Module } from '@nestjs/common';
import { PresenceTracker } from './presence-tracker';

// A Presença em memória, num módulo sem dependências: o tempo real a alimenta, e as rotas de
// Pessoas e de Conversas a leem.
@Module({
  providers: [PresenceTracker],
  exports: [PresenceTracker],
})
export class PresenceModule {}
