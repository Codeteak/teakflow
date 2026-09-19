import { fileKindFrom, type STORAGE_BUCKETS } from '@teakflow/shared';
import type { StoredFile } from '@teakflow/shared';
import type { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../config/cloudinary';
import { isCloudinaryConfigured } from '../config/env';
import { AppError } from '../middlewares/errorHandler/index';
import { spreadsheetPreview } from './spreadsheetPreview';

type StorageFolder = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

function requireCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Cloudinary is not configured.');
  }
}

function uploadBuffer(body: Buffer, options: Record<string, unknown>) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error('Upload failed.'));
        return;
      }
      resolve(result);
    });
    stream.end(body);
  });
}

export async function uploadPublicFile(
  bucket: StorageFolder,
  path: string,
  body: Buffer,
  contentType: string,
  originalName = path,
): Promise<StoredFile> {
  requireCloudinary();

  const publicId = path.replace(/\.[^/.]+$/, '');
  const isAudio = contentType.startsWith('audio/') || contentType.startsWith('video/');
  const isPdf = contentType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
  let result: UploadApiResponse;
  try {
    result = await uploadBuffer(body, {
      folder: `teakflow/${bucket}`,
      public_id: publicId,
      resource_type: isAudio ? 'video' : isPdf ? 'image' : 'auto',
      format: isPdf ? 'pdf' : undefined,
      overwrite: true,
      invalidate: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    throw new AppError(500, 'STORAGE_UPLOAD_FAILED', message);
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    contentType,
    originalName,
    kind: fileKindFrom(contentType, originalName),
    previewRows: spreadsheetPreview(body, originalName, contentType),
  };
}

export async function removeFile(_bucket: StorageFolder, path: string) {
  requireCloudinary();

  const publicId = path.includes('/') ? path : `teakflow/${_bucket}/${path.replace(/\.[^/.]+$/, '')}`;
  const { error } = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true }).then(
    () => ({ error: null as string | null }),
    (err: Error) => ({ error: err.message }),
  );

  if (error) {
    throw new AppError(500, 'STORAGE_DELETE_FAILED', error);
  }
}
