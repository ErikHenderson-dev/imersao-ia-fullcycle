import { IsString, MaxLength, ValidateBy } from 'class-validator';

// Um fuso IANA que o Node reconhece: o mesmo que a web formata depois (spec da F05, "Pessoas").
function isTimeZone(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export class SaveTimeZoneDto {
  @IsString()
  @MaxLength(64)
  @ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: isTimeZone,
      defaultMessage: () => 'time_zone precisa ser um fuso IANA.',
    },
  })
  time_zone!: string;
}
