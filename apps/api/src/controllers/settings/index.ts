import type { NextFunction, Request, Response } from 'express';
import { getCompanySettings, updateDailyWorkWindow } from '../../services/settings/index';

export async function get(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getCompanySettings();
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
}

export async function updateWindow(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await updateDailyWorkWindow(req.body, req.userId);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
}
