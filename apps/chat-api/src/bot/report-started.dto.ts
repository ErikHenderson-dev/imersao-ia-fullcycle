import { EditMessageDto } from '../messages/edit-message.dto';

// O Aviso de início leva o texto com as regras da Mensagem; a marca "dados de negócio" é da rota
// (spec da F14, "Ações de bot do Relatório").
export class ReportStartedDto extends EditMessageDto {}
