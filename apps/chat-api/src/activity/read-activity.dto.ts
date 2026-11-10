import { IsUUID } from 'class-validator';

// A marca de Atividade: a Notificação mais nova que a Pessoa viu (spec da F08, "Rotas").
export class ReadActivityDto {
  @IsUUID()
  message_id!: string;
}
