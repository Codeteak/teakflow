import { ROLES, updateDailyWorkWindowSchema } from '@teakflow/shared';
import { Router } from 'express';
import { get, updateWindow } from '../controllers/settings/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';
import { validateBody } from '../middlewares/validation/index';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.get('/', get);
settingsRouter.patch(
  '/daily-work',
  requireRole(ROLES.ADMIN),
  validateBody(updateDailyWorkWindowSchema),
  updateWindow,
);
