import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PeopleService } from '../people/people.service';
import { ProfileResponse, toProfileResponse } from '../people/profile.response';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { SaveTimeZoneDto } from './save-time-zone.dto';
import { UpdateProfileDto } from './update-profile.dto';

// O Perfil das Pessoas (spec da F05, "Rotas"). Fora do módulo de Pessoas porque o guard depende
// dele.
@Controller('people')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly people: PeopleService) {}

  // O próprio Perfil (spec da F09, "Rotas"): devolve o Perfil como `GET /v1/people/:id`.
  @Patch('me')
  async update(
    @CurrentPerson() person: Person,
    @Body() body: UpdateProfileDto,
  ): Promise<{ person: ProfileResponse }> {
    const updated = await this.people.updateOwnProfile(person.id, body);
    return { person: toProfileResponse(updated) };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ person: ProfileResponse }> {
    return { person: toProfileResponse(await this.people.getProfile(id)) };
  }

  // O fuso do navegador da Pessoa da Sessão (spec da F05, "Busca e Perfil", "Fuso").
  @Put('me/time-zone')
  @HttpCode(204)
  async saveTimeZone(
    @CurrentPerson() person: Person,
    @Body() body: SaveTimeZoneDto,
  ): Promise<void> {
    await this.people.saveTimeZone(person.id, body.time_zone);
  }
}
