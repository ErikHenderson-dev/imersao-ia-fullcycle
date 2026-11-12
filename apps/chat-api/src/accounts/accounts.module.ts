import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { BotsModule } from '../bots/bots.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DatabaseModule } from '../database/database.module';
import { PeopleModule } from '../people/people.module';
import { SessionsModule } from '../sessions/sessions.module';

// Contexto do comando de contas: sobe o Nest sem HTTP, com os services de Pessoas, Conversas (a
// conta nova entra nos Canais públicos), Sessões e bots (o @usuário reservado dos Agentes).
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    PeopleModule,
    ConversationsModule,
    SessionsModule,
    BotsModule,
  ],
})
export class AccountsModule {}
