import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { memoryStorage } from 'multer';

export type UploadDirectory =
  'profile' | 'booking-payments' | 'heritage' | 'sakoci';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

export function getPublicUploadRoot() {
  return process.env.LOCAL_PUBLIC_UPLOAD_ROOT || 'uploads';
}

export function getPrivateUploadRoot() {
  return process.env.LOCAL_PRIVATE_UPLOAD_ROOT || 'private-uploads';
}

export function isPrivateUploadDirectory(directory: UploadDirectory) {
  return directory === 'booking-payments';
}

export function getUploadRoot(directory: UploadDirectory) {
  return isPrivateUploadDirectory(directory)
    ? getPrivateUploadRoot()
    : getPublicUploadRoot();
}

export function getAllowedUploadTypes(
  allowPdf = false,
): Record<string, string> {
  return {
    ...IMAGE_EXTENSIONS,
    ...(allowPdf ? { 'application/pdf': '.pdf' } : {}),
  };
}

export function createUploadOptions(
  directory: UploadDirectory,
  allowPdf = false,
) {
  const allowedTypes = getAllowedUploadTypes(allowPdf);

  return {
    storage: memoryStorage(),
    fileFilter: (_request, file, callback) => {
      const allowed = Boolean(file.mimetype && allowedTypes[file.mimetype]);
      if (allowed)
        file.originalname = `${randomUUID()}${allowedTypes[file.mimetype]}`;
      callback(
        allowed
          ? null
          : new BadRequestException('Tipe file tidak diperbolehkan'),
        allowed,
      );
    },
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  };
}
