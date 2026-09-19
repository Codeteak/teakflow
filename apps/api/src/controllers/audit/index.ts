import type { NextFunction, Request, Response } from 'express';
import { listAuditLogs } from '../../services/audit/index';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 80;
    const limit = Number.isFinite(raw) ? raw : 80;
    const data = await listAuditLogs(limit);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
