import { API_PREFIX } from '@teakflow/shared';
import { Router } from 'express';
import { connectDatabase } from '../config/database';
import { connectStorage } from '../config/cloudinary';
import { authRouter } from './auth';
import { auditRouter } from './audit';
import { conversationsRouter, messagesRouter } from './chat';
import { dailyWorkRouter } from './dailyWork';
import { filesRouter } from './files';
import { meetingsRouter } from './meetings';
import { notificationsRouter } from './notifications';
import { settingsRouter } from './settings';
import { salesRouter } from './sales';
import { usersRouter } from './users';

export const router = Router();

router.get('/health', async (_req, res) => {
  const [database, storage] = await Promise.all([connectDatabase(), connectStorage()]);

  res.json({
    data: {
      ok: true,
      service: 'teakflow-api',
      database,
      storage,
    },
  });
});

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/files', filesRouter);
router.use('/settings', settingsRouter);
router.use('/daily-work', dailyWorkRouter);
router.use('/conversations', conversationsRouter);
router.use('/messages', messagesRouter);
router.use('/meetings', meetingsRouter);
router.use('/sales', salesRouter);
router.use('/notifications', notificationsRouter);
router.use('/audit-logs', auditRouter);

export const apiPrefix = API_PREFIX;
