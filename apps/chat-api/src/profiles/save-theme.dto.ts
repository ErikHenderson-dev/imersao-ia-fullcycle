import { IsIn } from 'class-validator';
import { THEMES, type Theme } from '../people/profile-values';

// O tema escolhido (spec da F09, "Rotas").
export class SaveThemeDto {
  @IsIn(THEMES)
  theme!: Theme;
}
