import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PeopleService } from '../people/people.service';
import { ProfileResponse, toProfileResponse } from '../people/profile.response';
import { AuthGuard } from '../sessions/auth.guard';

// O Perfil das Pessoas (spec da F05, "Rotas"). Fora do módulo de Pessoas porque o guard depende
// dele.
@Controller('people')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly people: PeopleService) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ person: ProfileResponse }> {
    return { person: toProfileResponse(await this.people.getProfile(id)) };
  }
}
