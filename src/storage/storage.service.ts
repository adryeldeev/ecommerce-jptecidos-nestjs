import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { ensureDirectory } from '../common/storage/storage.util';
import {
  PRODUCT_IMAGES_FOLDER,
  PRODUCT_IMAGES_UPLOAD_DIR,
  PUBLIC_UPLOADS_PREFIX,
  STORAGE_DRIVER_LOCAL,
  STORAGE_DRIVER_S3,
} from './storage.constants';
import type { UploadFileInput, UploadFileResult } from './storage.types';

@Injectable()
export class StorageService {
  private readonly driver: string;
  private readonly bucket?: string;
  private readonly region?: string;
  private readonly publicBaseUrl?: string;
  private readonly s3Client?: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.driver = this.configService.get<string>('STORAGE_DRIVER') ?? STORAGE_DRIVER_LOCAL;
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
    this.region = this.configService.get<string>('AWS_REGION');
    this.publicBaseUrl = this.configService.get<string>('AWS_S3_PUBLIC_BASE_URL');

    if (this.driver === STORAGE_DRIVER_S3) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials:
          this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
            ? {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
              }
            : undefined,
      });
    }
  }

  async uploadProductImage(input: Omit<UploadFileInput, 'folder'>): Promise<UploadFileResult> {
    return this.uploadFile({
      ...input,
      folder: PRODUCT_IMAGES_UPLOAD_DIR,
    });
  }

  private async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    return this.driver === STORAGE_DRIVER_S3
      ? this.uploadToS3(input)
      : this.uploadToLocal(input);
  }

  private async uploadToS3(input: UploadFileInput): Promise<UploadFileResult> {
    if (!this.s3Client || !this.bucket || !this.region) {
      throw new InternalServerErrorException('S3 nao configurado corretamente.');
    }

    const extension = extname(input.originalName);
    const sanitizedFolder = input.folder.replace(/\\/g, '/');
    const key = `${sanitizedFolder}/${randomUUID()}${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType ?? 'application/octet-stream',
      }),
    );

    return {
      key,
      url: this.buildS3PublicUrl(key),
    };
  }

  private async uploadToLocal(input: UploadFileInput): Promise<UploadFileResult> {
    const extension = extname(input.originalName);
    const filename = `${randomUUID()}${extension}`;
    const destination = join(process.cwd(), input.folder);
    ensureDirectory(destination);

    await fs.writeFile(join(destination, filename), input.buffer);

    return {
      key: `${input.folder}/${filename}`.replace(/\\/g, '/'),
      url: `${PUBLIC_UPLOADS_PREFIX}/${PRODUCT_IMAGES_FOLDER}/${filename}`,
    };
  }

  private buildS3PublicUrl(key: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
