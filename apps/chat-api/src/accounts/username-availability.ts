import { BotsService } from '../bots/bots.service';
import { PeopleService } from '../people/people.service';
import { UsernameOwner } from './username-unavailable.error';

// A função única de "@usuário livre" (spec da F10, "Bots"): um @usuário não pode estar ao mesmo
// tempo em `people` e em `bots`. Só o comando de contas cria @usuário, e é ele quem a usa.
export class UsernameAvailability {
  constructor(
    private readonly people: PeopleService,
    private readonly bots: BotsService,
  ) {}

  async ownerOf(username: string): Promise<UsernameOwner | null> {
    if (await this.people.findByUsername(username)) return 'person';
    if (await this.bots.findByUsername(username)) return 'bot';
    return null;
  }

  async isFree(username: string): Promise<boolean> {
    return (await this.ownerOf(username)) === null;
  }
}
