import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Apoio da F14: grava no S3 do contêiner um PDF de exemplo, como o Worker grava (spec da F14,
// "Armazenamento"), para o teste entregar pela rota do Worker e baixar pelo ReportCard.
export const SAMPLE_PDF = Buffer.from("%PDF-1.4\n% PDF de exemplo do Playwright\n%%EOF\n", "latin1");

export async function putSamplePdf(key: string): Promise<number> {
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const Bucket = process.env.S3_BUCKET!;
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: SAMPLE_PDF, ContentType: "application/pdf" }));
  s3.destroy();
  return SAMPLE_PDF.length;
}
