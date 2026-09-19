import type { RequestHandler } from 'express';
import { ACCESS_COOKIE, getSessionUser, readSession } from '../../services/auth/index';
import { AppError } from '../errorHandler/index';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token =
      (req.cookies?.[ACCESS_COOKIE] as string | undefined) ??
      (req.cookies?.teakflow_session as string | undefined);
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    const userId = readSession(token);
    const user = await getSessionUser(userId);
    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
