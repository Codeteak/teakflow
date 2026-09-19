import { Router } from 'express';
import { ROLES } from '@teakflow/shared';
import {
  disconnectGoogleAccount,
  googleCallback,
  login,
  logout,
  me,
  refresh,
  startGoogle,
} from '../controllers/auth/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';
import { authRateLimit } from '../middlewares/rateLimit/index';

export const authRouter = Router();

authRouter.post('/login', authRateLimit, login);
authRouter.post('/logout', logout);
authRouter.post('/refresh', authRateLimit, refresh);
authRouter.get('/me', requireAuth, me);
authRouter.get('/google', requireAuth, requireRole(ROLES.ADMIN), startGoogle);
authRouter.get('/google/callback', googleCallback);
authRouter.delete('/google', requireAuth, requireRole(ROLES.ADMIN), disconnectGoogleAccount);
