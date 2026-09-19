import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middlewares/errorHandler/index';
import {
  getAdminView,
  getEntry,
  getToday,
  getUserEntry,
  listHistory,
  listHistoryForUser,
  submitToday,
  updateToday,
} from '../../services/dailyWork/index';

function requireUser(req: Request) {
  if (!req.userId || !req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return req.user;
}

export async function today(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await getToday(user.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await submitToday(user.id, req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await updateToday(user.id, req.body);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await listHistory(user.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function admin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const data = await getAdminView(user.id, user.role, new Date(), date);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function historyForUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await listHistoryForUser(user.id, user.role, String(req.params.userId));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function byUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const data = await getUserEntry(user.id, user.role, String(req.params.userId), date);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const data = await getEntry(user.id, String(req.params.id), user.role);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
