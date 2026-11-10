import { IsIn } from 'class-validator';

// A escolha de presença (spec da F09, "Rotas").
export class SavePresenceChoiceDto {
  @IsIn(['available', 'away'])
  presence_choice!: 'available' | 'away';
}
