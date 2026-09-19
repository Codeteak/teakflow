import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middlewares/errorHandler/index';
import { createMeeting, getMeeting, joinMeeting, listMeetings } from '../../services/meetings/index';

function requireUser(req: Request) {
  if (!req.userId || !req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return req.user;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listMeetings(requireUser(req));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createMeeting(requireUser(req), req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMeeting(requireUser(req), String(req.params.id));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function join(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await joinMeeting(requireUser(req), String(req.params.id));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
