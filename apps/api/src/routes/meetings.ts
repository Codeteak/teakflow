import { createMeetingSchema } from '@teakflow/shared';
import { Router } from 'express';
import { byId, create, join, list } from '../controllers/meetings/index';
import { requireAuth } from '../middlewares/auth/index';
import { validateBody } from '../middlewares/validation/index';

export const meetingsRouter = Router();

meetingsRouter.use(requireAuth);
meetingsRouter.get('/', list);
meetingsRouter.post('/', validateBody(createMeetingSchema), create);
meetingsRouter.get('/:id', byId);
meetingsRouter.post('/:id/join', join);
