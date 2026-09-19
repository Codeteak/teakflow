import type { RequestHandler } from 'express';
import type { Role } from '@teakflow/shared';
import { AppError } from '../errorHandler/index';

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.'));
      return;
    }
    next();
  };
}
