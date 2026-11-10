import { Command, CommandOutput } from '../common/cli/command';
import { DomainError } from '../common/errors/domain.error';
import { ConversationsService } from '../conversations/conversations.service';

const USAGE = `Uso: pnpm channels <operação> [argumentos]

Operações:
  create <nome> ["<tópico>"]  Cria um Canal público, com todas as Pessoas como Membros
  set-topic <nome> "<tópico>" Troca o Tópico do Canal; "" apaga
  list                        Lista os Canais, com o número de Membros e o Tópico
  remove-member <nome> <e-mail>
                              Tira a Pessoa de um Canal privado`;

// Comando de canais de quem opera a instalação (spec da F02 e da F04, "Comando de canais").
// Devolve o código de saída do processo.
export class ChannelsCommand implements Command {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly output: CommandOutput,
  ) {}

  async run(args: string[]): Promise<number> {
    const [operation, ...rest] = args;
    try {
      switch (operation) {
        case 'create':
          return await this.create(rest);
        case 'set-topic':
          return await this.setTopic(rest);
        case 'list':
          return await this.list(rest);
        case 'remove-member':
          return await this.removeMember(rest);
        default:
          this.output.error(USAGE);
          return 1;
      }
    } catch (error) {
      if (error instanceof DomainError) {
        this.output.error(error.message);
        return 1;
      }
      throw error;
    }
  }

  private async create([name, topic, ...extra]: string[]): Promise<number> {
    // Um Tópico de várias palavras sem aspas chegaria partido: recusa, em vez de gravar só a
    // primeira palavra.
    if (name === undefined || extra.length > 0) {
      this.output.error('Uso: pnpm channels create <nome> ["<tópico>"]');
      return 1;
    }
    const channel = await this.conversations.createPublicChannel(name, topic);
    this.output.info(`Canal #${channel.name} criado.`);
    return 0;
  }

  private async setTopic([name, topic, ...extra]: string[]): Promise<number> {
    // O Tópico é obrigatório como argumento ("" apaga), e um de várias palavras vem entre aspas.
    if (name === undefined || topic === undefined || extra.length > 0) {
      this.output.error('Uso: pnpm channels set-topic <nome> "<tópico>"');
      return 1;
    }
    const channel = await this.conversations.setPublicChannelTopic(name, topic);
    this.output.info(
      channel.topic === null
        ? `Tópico de #${channel.name} apagado.`
        : `Tópico de #${channel.name} trocado.`,
    );
    return 0;
  }

  private async removeMember([
    name,
    email,
    ...extra
  ]: string[]): Promise<number> {
    if (name === undefined || email === undefined || extra.length > 0) {
      this.output.error('Uso: pnpm channels remove-member <nome> <e-mail>');
      return 1;
    }
    const removed = await this.conversations.removeMember(name, email);
    this.output.info(`${removed.personName} saiu de #${removed.channelName}.`);
    return 0;
  }

  private async list(extra: string[]): Promise<number> {
    if (extra.length > 0) {
      this.output.error('Uso: pnpm channels list');
      return 1;
    }
    const channels = await this.conversations.listPublicChannels();
    if (channels.length === 0) {
      this.output.info('Nenhum Canal.');
      return 0;
    }
    for (const channel of channels) {
      const members =
        channel.memberCount === 1
          ? '1 Membro'
          : `${channel.memberCount} Membros`;
      this.output.info(
        channel.topic
          ? `#${channel.name} (${members}) ${channel.topic}`
          : `#${channel.name} (${members})`,
      );
    }
    return 0;
  }
}
