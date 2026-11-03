import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { basename, extname } from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  isPrivateUploadDirectory,
  type UploadDirectory,
} from '../upload/upload-options';

export interface StoredUpload {
  directory: UploadDirectory;
  filename: string;
  key: string;
  url: string;
  mimetype: string;
  size?: number;
  visibility: 'public' | 'private';
  driver: 's3';
}

type UploadedFileLike = {
  filename?: string;
  originalname?: string;
  mimetype: string;
  size?: number;
  buffer?: Buffer;
};

@Injectable()
export class StorageService {
  private readonly publicBucket =
    process.env.S3_PUBLIC_BUCKET || 'cimitage-public';
  private readonly privateBucket =
    process.env.S3_PRIVATE_BUCKET || 'cimitage-private';
  private readonly s3 = new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
  });

  async fromUploadedFile(
    _request: { protocol?: string; get?: (name: string) => string | undefined },
    directory: UploadDirectory,
    file: UploadedFileLike,
    options?: { privateUrl?: string },
  ): Promise<StoredUpload> {
    this.assertConfigured();
    if (!file.buffer)
      throw new InternalServerErrorException('File upload tidak valid');

    const filename = basename(file.filename || file.originalname || '');
    const key = `${directory}/${filename}`;
    const visibility = isPrivateUploadDirectory(directory)
      ? 'private'
      : 'public';
    const bucket = this.bucketFor(directory);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    return {
      directory,
      filename,
      key,
      url:
        visibility === 'private'
          ? options?.privateUrl || key
          : this.publicUrl(directory, filename),
      mimetype: file.mimetype,
      size: file.size,
      visibility,
      driver: 's3',
    };
  }

  publicUrl(directory: UploadDirectory, filename: string) {
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    if (publicBase) return `${publicBase}/${directory}/${basename(filename)}`;

    const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/+$/, '');
    if (!endpoint)
      throw new InternalServerErrorException(
        'Konfigurasi storage belum lengkap',
      );
    return `${endpoint}/${this.publicBucket}/${directory}/${basename(filename)}`;
  }

  async getPrivateReadUrl(reference: string, directory: UploadDirectory) {
    this.assertConfigured();
    const filename = this.extractSafeFilename(reference);
    const command = new GetObjectCommand({
      Bucket: this.bucketFor(directory),
      Key: `${directory}/${filename}`,
    });
    return {
      url: await getSignedUrl(this.s3, command, { expiresIn: 5 * 60 }),
      mimetype: this.mimetypeFor(filename),
    };
  }

  async deleteIfManaged(reference?: string | null) {
    if (!reference) return;
    const parsed = this.parseManagedReference(reference);
    if (!parsed) return;
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: parsed.bucket,
          Key: parsed.key,
        }),
      );
    } catch {
      // Best effort cleanup: replacing an image must not fail because the old file is already gone.
    }
  }

  private bucketFor(directory: UploadDirectory) {
    return isPrivateUploadDirectory(directory)
      ? this.privateBucket
      : this.publicBucket;
  }

  private assertConfigured() {
    if (
      !process.env.AWS_ENDPOINT_URL_S3 ||
      !process.env.AWS_REGION ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      throw new InternalServerErrorException(
        'Konfigurasi Neon Object Storage belum lengkap',
      );
    }
  }

  private extractSafeFilename(reference: string) {
    let filename = '';
    try {
      const parsed = new URL(reference);
      filename = parsed.searchParams.get('file') || basename(parsed.pathname);
    } catch {
      filename = basename(reference);
    }
    if (!/^[a-zA-Z0-9-]+\.(?:jpe?g|png|webp|pdf)$/i.test(filename)) {
      throw new NotFoundException('File tidak ditemukan');
    }
    return filename;
  }

  private parseManagedReference(reference: string) {
    const buckets = [this.publicBucket, this.privateBucket];
    try {
      const parsed = new URL(reference);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const bucketIndex = parts.findIndex((part) => buckets.includes(part));
      if (bucketIndex >= 0 && parts.length > bucketIndex + 2) {
        return {
          bucket: parts[bucketIndex],
          key: parts.slice(bucketIndex + 1).join('/'),
        };
      }
    } catch {
      // Fall through to key parsing.
    }

    const parts = reference.split('/').filter(Boolean);
    if (
      parts.length === 2 &&
      ['profile', 'heritage', 'sakoci', 'booking-payments'].includes(parts[0])
    ) {
      return {
        bucket:
          parts[0] === 'booking-payments'
            ? this.privateBucket
            : this.publicBucket,
        key: parts.join('/'),
      };
    }
    return null;
  }

  private mimetypeFor(filename: string) {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    return (
      mimeTypes[extname(filename).toLowerCase()] || 'application/octet-stream'
    );
  }
}
