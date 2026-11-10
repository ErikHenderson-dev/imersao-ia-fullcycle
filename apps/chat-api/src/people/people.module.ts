import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../messages/message.entity';
import { PasswordHasher } from './password-hasher';
import { PeopleService } from './people.service';
import { Person } from './person.entity';

@Module({
  // Registra a entidade no autoLoadEntities; o service usa o TransactionHost, e não este
  // repositório. Message e Conversation: a Pessoa aponta para a marca de Atividade (spec da F08), e
  // sem elas registradas um módulo que importa só este não monta os metadados da relação.
  imports: [TypeOrmModule.forFeature([Person, Message, Conversation])],
  providers: [PeopleService, PasswordHasher],
  exports: [PeopleService],
})
export class PeopleModule {}
