import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bot } from './bot.entity';
import { BotsService } from './bots.service';

@Module({
  // Registra a entidade no autoLoadEntities; o service usa o TransactionHost.
  imports: [TypeOrmModule.forFeature([Bot])],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
