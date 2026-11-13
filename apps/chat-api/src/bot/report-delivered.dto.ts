import { IsInt, IsPositive, IsString, Length, Matches } from 'class-validator';
import { REPORT_FILE_NAME_MAX_LENGTH } from '../messages/message-values';

const REPORT_STORAGE_KEY = /^reports\/[0-9a-f-]{36}\.pdf$/;

// O PDF que o Worker já gravou no armazenamento de objetos (spec da F14, "Ações de bot do
// Relatório"): a chave sob `reports/`, o nome do arquivo para a Pessoa e o tamanho.
export class ReportDeliveredDto {
  // A chave do PDF do próprio Pedido, `reports/<id do Pedido>.pdf`, conferida no service.
  @IsString()
  @Matches(REPORT_STORAGE_KEY)
  storage_key!: string;

  // Só letras minúsculas sem acento, algarismos, ponto e hífen: o nome vai para o cabeçalho
  // `Content-Disposition` da URL assinada (spec da F14, "O PDF", "Nome do arquivo").
  @IsString()
  @Length(5, REPORT_FILE_NAME_MAX_LENGTH)
  @Matches(/^[a-z0-9][a-z0-9.-]*\.pdf$/)
  file_name!: string;

  @IsInt()
  @IsPositive()
  size_bytes!: number;
}
