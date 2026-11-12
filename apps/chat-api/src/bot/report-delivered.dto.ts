import { IsInt, IsPositive, IsString, Length, Matches } from 'class-validator';
import { REPORT_FILE_NAME_MAX_LENGTH } from '../messages/message-values';

// O PDF que o Worker já gravou no armazenamento de objetos (spec da F14, "Ações de bot do
// Relatório"): a chave sob `reports/`, o nome do arquivo para a Pessoa e o tamanho.
export class ReportDeliveredDto {
  @IsString()
  @Length(9, REPORT_FILE_NAME_MAX_LENGTH)
  @Matches(/^reports\//)
  storage_key!: string;

  @IsString()
  @Length(5, REPORT_FILE_NAME_MAX_LENGTH)
  @Matches(/\.pdf$/)
  file_name!: string;

  @IsInt()
  @IsPositive()
  size_bytes!: number;
}
