// O armazenamento de objetos, onde o Worker grava o PDF do Relatório (LLD, "Integrações externas",
// "Armazenamento de objetos (S3)"). A API do chat só assina a URL de download.
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface DownloadOptions {
  // O nome do arquivo para a Pessoa, no `Content-Disposition` da resposta do armazenamento.
  fileName: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface ObjectStorage {
  downloadUrl(key: string, options: DownloadOptions): Promise<string>;
}
