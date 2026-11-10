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
import type { Presence, StatusPayload } from 'chat-events';
import { PresenceTracker } from '../presence/presence-tracker';
import { SavePresenceChoiceDto } from './save-presence-choice.dto';
import { SaveThemeDto } from './save-theme.dto';
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
    private readonly presence: PresenceTracker,
  ) {}

  // O próprio Perfil (spec da F09, "Rotas"): devolve o Perfil como `GET /v1/people/:id`.
  @Patch('me')
  async update(
    @CurrentPerson() person: Person,
    @Body() body: UpdateProfileDto,
  ): Promise<{ person: ProfileResponse & { presence: Presence } }> {
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
    return { person: this.profileOf(updated) };
  }

  // O retrato de quem está disponível ou tem Status (spec da F09, "Rotas"); antes de `:id`, que o
  // tomaria.
  @Get('presence')
  async snapshot(): Promise<{
    people: { id: string; presence: Presence; status: StatusPayload | null }[];
  }> {
    const withStatus = await this.people.listWithStatus();
    const statusById = new Map(
      withStatus.map((person) => [person.id, toStatusResponse(person)]),
    );
    const ids = new Set([
      ...statusById.keys(),
      ...this.presence.availableIds(),
    ]);
    return {
      people: [...ids].map((id) => ({
        id,
        presence: this.presence.presenceOf(id),
        status: statusById.get(id) ?? null,
      })),
    };
  }

  // A escolha de presença (spec da F09, "Rotas"): a mesma de novo não publica.
  @Put('me/presence')
  @HttpCode(204)
  async savePresenceChoice(
    @CurrentPerson() person: Person,
    @Body() body: SavePresenceChoiceDto,
  ): Promise<void> {
    const saved = await this.people.savePresenceChoice(
      person.id,
      body.presence_choice,
    );
    // Sempre: o rastreador só publica se a Presença mudar, ignora uma gravação mais velha que chegue
    // depois e corrige uma aba que conectou com a escolha velha enquanto esta gravação corria.
    this.presence.choiceChanged(person.id, saved.choice, saved.savedAt);
  }

  // O tema da Pessoa (spec da F09, "Rotas"): sem evento.
  @Put('me/theme')
  @HttpCode(204)
  async saveTheme(
    @CurrentPerson() person: Person,
    @Body() body: SaveThemeDto,
  ): Promise<void> {
    await this.people.saveTheme(person.id, body.theme);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
  ): Promise<{ person: ProfileResponse & { presence: Presence } }> {
    return { person: this.profileOf(await this.people.getProfile(id)) };
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

  private profileOf(person: Person): ProfileResponse & { presence: Presence } {
    return {
      ...toProfileResponse(person),
      presence: this.presence.presenceOf(person.id),
    };
  }
}
