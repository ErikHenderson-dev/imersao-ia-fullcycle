import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { DownloadOptions, ObjectStorage } from './object-storage';
import { storageConfig } from './storage.config';

// O armazenamento compatível com S3, com acesso por caminho (path-style), como o substituto local
// (LLD, "Ambiente de desenvolvimento"). Assinar não chama a rede.
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    @Inject(storageConfig.KEY)
    config: ConfigType<typeof storageConfig>,
  ) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.publicEndpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  downloadUrl(
    key: string,
    { fileName, contentType, expiresInSeconds }: DownloadOptions,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
        ResponseContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
