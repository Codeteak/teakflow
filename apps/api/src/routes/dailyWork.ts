import { ROLES, submitDailyWorkSchema } from '@teakflow/shared';
import { Router } from 'express';
import { admin, byId, byUser, history, historyForUser, submit, today, update } from '../controllers/dailyWork/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';
import { validateBody } from '../middlewares/validation/index';

export const dailyWorkRouter = Router();

dailyWorkRouter.use(requireAuth);
dailyWorkRouter.get('/today', today);
dailyWorkRouter.post('/', validateBody(submitDailyWorkSchema), submit);
dailyWorkRouter.patch('/today', validateBody(submitDailyWorkSchema), update);
dailyWorkRouter.get('/history', history);
dailyWorkRouter.get('/admin', requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.LEAD), admin);
dailyWorkRouter.get('/user/:userId/history', requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.LEAD), historyForUser);
dailyWorkRouter.get('/user/:userId', requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.LEAD), byUser);
dailyWorkRouter.get('/:id', byId);
