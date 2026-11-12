import { IsBoolean, IsOptional } from 'class-validator';
import { EditMessageDto } from '../messages/edit-message.dto';

// A resposta do bot leva o texto com as regras da Mensagem (spec da F11, "Rotas do bot e
// credencial") e, opcional, a marca "dados de negócio" (spec da F13, "Marca e Resposta bloqueada").
export class ReplyDto extends EditMessageDto {
  @IsOptional()
  @IsBoolean()
  business_data?: boolean;
}
