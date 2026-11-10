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
import type { StatusPayload } from 'chat-events';
import { Person } from '../people/person.entity';
import { toStatusResponse } from '../people/status.response';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { SaveTimeZoneDto } from './save-time-zone.dto';
import { UpdateProfileDto } from './update-profile.dto';

// O Perfil das Pessoas (spec da F05, "Rotas"). Fora do módulo de Pessoas porque o guard depende
// dele.
@Controller('people')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(
    private readonly people: PeopleService,
    private readonly realtime: RealtimePublisher,
  ) {}

  // O próprio Perfil (spec da F09, "Rotas"): devolve o Perfil como `GET /v1/people/:id`.
  @Patch('me')
  async update(
    @CurrentPerson() person: Person,
    @Body() body: UpdateProfileDto,
  ): Promise<{ person: ProfileResponse }> {
    const { previous, person: updated } = await this.people.updateProfileById(
      person.id,
      {
        name: body.name,
        title: body.title,
        phone: body.phone,
        statusEmoji: body.status_emoji,
        statusText: body.status_text,
      },
    );
    // O que o workspace vê mudou nesta gravação: vai para todos, depois do commit (spec da F09,
    // "Tempo real").
    if (
      updated.name !== previous.name ||
      updated.title !== previous.title ||
      updated.statusEmoji !== previous.statusEmoji ||
      updated.statusText !== previous.statusText
    ) {
      this.realtime.personUpdated({
        id: updated.id,
        name: updated.name,
        username: updated.username,
        title: updated.title,
        status: toStatusResponse(updated),
      });
    }
    return { person: toProfileResponse(updated) };
  }

  // O retrato de quem tem Status (spec da F09, "Rotas"); antes de `:id`, que o tomaria.
  @Get('presence')
  async presence(): Promise<{
    people: { id: string; status: StatusPayload | null }[];
  }> {
    const people = await this.people.listWithStatus();
    return {
      people: people.map((person) => ({
        id: person.id,
        status: toStatusResponse(person),
      })),
    };
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
