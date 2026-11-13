import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// O PDF de exemplo dos testes, gravado no S3 do contêiner como o Worker grava (spec da F14,
// "Armazenamento"): só o cabeçalho e o fim de um PDF, o bastante para conferir o download.
export const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n% PDF de exemplo dos testes\n%%EOF\n',
  'latin1',
);

function client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://s3:8333',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

// Grava o PDF de exemplo na chave, criando o bucket se ele não existir.
export async function putSamplePdf(key: string): Promise<void> {
  const s3 = client();
  const Bucket = process.env.S3_BUCKET!;
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: SAMPLE_PDF,
      ContentType: 'application/pdf',
    }),
  );
  s3.destroy();
}
