import type { Presence } from 'chat-events';
import { IsIn } from 'class-validator';
import { PRESENCE_CHOICES } from '../people/profile-values';

// A escolha de presença (spec da F09, "Rotas").
export class SavePresenceChoiceDto {
  @IsIn(PRESENCE_CHOICES)
  presence_choice!: Presence;
}
