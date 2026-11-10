import { IsString, MaxLength, ValidateBy } from 'class-validator';

import { canonicalTimeZone } from '../people/time-zone';

// Um fuso IANA que o Node reconhece: o mesmo que a web formata depois (spec da F05, "Pessoas").
function isTimeZone(value: unknown): boolean {
  return typeof value === 'string' && canonicalTimeZone(value) !== null;
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
