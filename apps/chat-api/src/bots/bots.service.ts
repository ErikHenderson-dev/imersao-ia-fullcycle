import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { parseName } from '../people/profile-values';
import { parseUsername } from '../people/username';
import { Bot } from './bot.entity';

// Os bots dos Agentes (spec da F10, "Bots"). Na F10, só o comando de contas os cria e consulta.
@Injectable()
export class BotsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get bots(): Repository<Bot> {
    return this.txHost.tx.getRepository(Bot);
  }

  // Cria o bot com o @usuário e o nome pelas regras das Pessoas. Quem chama confere antes que o
  // @usuário está livre nas duas tabelas.
  create({ username, name }: { username: string; name: string }): Promise<Bot> {
    return this.bots.save(
      this.bots.create({
        username: parseUsername(username),
        name: parseName(name),
      }),
    );
  }

  findByUsername(username: string): Promise<Bot | null> {
    return this.bots.findOneBy({ username });
  }
}
