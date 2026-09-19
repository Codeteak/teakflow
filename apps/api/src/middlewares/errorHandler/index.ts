import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import {
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function payload(code: string, message: string, details?: Record<string, unknown>) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(payload(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      payload('VALIDATION_ERROR', err.issues[0]?.message ?? 'Invalid request.', {
        issues: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    );
    return;
  }

  if (err instanceof MulterError) {
    res
      .status(400)
      .json(payload('UPLOAD_INVALID', err.message || 'That file could not be uploaded.'));
    return;
  }

  if (err instanceof UniqueConstraintError) {
    res.status(409).json(payload('CONFLICT', 'That record already exists.'));
    return;
  }

  if (err instanceof SequelizeValidationError) {
    res
      .status(400)
      .json(payload('VALIDATION_ERROR', err.errors[0]?.message ?? 'Invalid data.'));
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(payload('VALIDATION_ERROR', 'Request body must be valid JSON.'));
    return;
  }

  console.error(err);
  res.status(500).json(payload('INTERNAL_ERROR', 'Something went wrong.'));
};
