import { ROLES, createUserSchema, updateUserSchema } from '@teakflow/shared';
import { Router } from 'express';
import { create, list, update } from '../controllers/users/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';
import { validateBody } from '../middlewares/validation/index';

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get('/', list);
usersRouter.post('/', requireRole(ROLES.ADMIN), validateBody(createUserSchema), create);
usersRouter.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validateBody(updateUserSchema),
  update,
);
