import { Router } from 'express';
import { list, readAll, readOne } from '../controllers/notifications/index';
import { requireAuth } from '../middlewares/auth/index';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/', list);
notificationsRouter.post('/read-all', readAll);
notificationsRouter.post('/:id/read', readOne);
