import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../errorHandler/index';

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request.';
      next(new AppError(400, 'VALIDATION_ERROR', message));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
