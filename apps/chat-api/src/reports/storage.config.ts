import { registerAs } from '@nestjs/config';
import { loadEnv } from '../config/env.schema';

// O armazenamento de objetos da API do chat (spec da F14, "Armazenamento"): a URL de download é
// assinada com o endereço público, que o navegador alcança, porque a assinatura inclui o host
// (LLD, "Ambiente de desenvolvimento", "Endereço do S3").
export const storageConfig = registerAs('storage', () => {
  const env = loadEnv();
  return {
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
});
