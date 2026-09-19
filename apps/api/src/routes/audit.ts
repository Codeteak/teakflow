import { Router } from 'express';
import { ROLES } from '@teakflow/shared';
import { list } from '../controllers/audit/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole(ROLES.ADMIN), list);
