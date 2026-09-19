import type { NextFunction, Request, Response } from 'express';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications/index';
import { AppError } from '../../middlewares/errorHandler/index';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await listNotifications(req.userId!) });
  } catch (error) {
    next(error);
  }
}

export async function readOne(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const row = await markNotificationRead(req.userId!, id);
    if (!row) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
}

export async function readAll(req: Request, res: Response, next: NextFunction) {
  try {
    await markAllNotificationsRead(req.userId!);
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
}
