import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { STORAGE_BUCKETS } from '@teakflow/shared';
import { AppError } from '../../middlewares/errorHandler/index';
import { fetchLinkPreview } from '../../services/linkPreview';
import { uploadPublicFile } from '../../services/storage';
import { updateOwnAvatar } from '../../services/users/index';

const FOLDERS = new Set<string>(Object.values(STORAGE_BUCKETS));
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const BLOCKED_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
]);

function folderFrom(req: Request) {
  const raw =
    typeof req.body?.folder === 'string' ? req.body.folder : STORAGE_BUCKETS.FILES;
  if (!FOLDERS.has(raw)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unknown upload folder.');
  }
  return raw as (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
}

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Choose a file to upload.');
    }

    if (
      BLOCKED_TYPES.has(file.mimetype) ||
      /\.(exe|bat|cmd|msi|sh)$/i.test(file.originalname)
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'That file type cannot be uploaded.');
    }

    const folder = folderFrom(req);
    if (folder === STORAGE_BUCKETS.AVATARS && !IMAGE_TYPES.has(file.mimetype)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Use a JPEG, PNG, GIF, or WebP image.');
    }
    const stored = await uploadPublicFile(
      folder,
      `${req.userId}-${randomUUID()}`,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    res.status(201).json({ data: stored });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Choose a photo to upload.');
    }
    if (!IMAGE_TYPES.has(file.mimetype)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Use a JPEG, PNG, GIF, or WebP image.');
    }

    const stored = await uploadPublicFile(
      STORAGE_BUCKETS.AVATARS,
      req.userId!,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const user = await updateOwnAvatar(req.userId!, stored.url);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

export async function previewLink(req: Request, res: Response, next: NextFunction) {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A URL is required.');
    }
    const preview = await fetchLinkPreview(url);
    res.json({ data: preview });
  } catch (error) {
    next(error);
  }
}
