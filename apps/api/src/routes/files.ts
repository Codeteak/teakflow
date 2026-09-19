import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { upload, uploadAvatar, previewLink } from '../controllers/files/index';
import { requireAuth } from '../middlewares/auth/index';
import { AppError } from '../middlewares/errorHandler/index';

const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
}).single('file');

const acceptFile: RequestHandler = (req, res, next) => {
  uploadSingle(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message = error instanceof Error ? error.message : 'Could not read the file.';
    next(new AppError(400, 'UPLOAD_INVALID', message));
  });
};

export const filesRouter = Router();

filesRouter.use(requireAuth);
filesRouter.post('/', acceptFile, upload);
filesRouter.post('/avatar', acceptFile, uploadAvatar);
filesRouter.post('/link-preview', previewLink);
