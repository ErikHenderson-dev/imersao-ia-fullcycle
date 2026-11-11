import { EditMessageDto } from '../messages/edit-message.dto';

// A resposta do bot leva o texto com as regras da Mensagem (spec da F11, "Rotas do bot e
// credencial").
export class ReplyDto extends EditMessageDto {}
