import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middlewares/errorHandler/index';
import { createUser, listUsers, updateUser } from '../../services/users/index';

function requireUser(req: Request) {
  if (!req.userId || !req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return req.user;
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await listUsers();
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = requireUser(req);
    const user = await createUser(actor.id, req.body);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = requireUser(req);
    const user = await updateUser(actor.id, String(req.params.id), req.body);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}
