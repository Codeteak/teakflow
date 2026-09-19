import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@teakflow/shared';
import { AppError } from '../errorHandler/index';
import { requireRole } from './index';

function call(
  role: string | undefined,
  allowed: Array<(typeof ROLES)[keyof typeof ROLES]>,
) {
  const req = { user: role ? { role } : undefined } as Request;
  const next = vi.fn() as unknown as NextFunction;
  requireRole(...allowed)(req, {} as Response, next);
  return next as unknown as ReturnType<typeof vi.fn>;
}

describe('requireRole', () => {
  it('allows an admin on an admin route', () => {
    const next = call(ROLES.ADMIN, [ROLES.ADMIN]);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows a lead on team-supervisor routes', () => {
    const next = call(ROLES.LEAD, [ROLES.ADMIN, ROLES.MANAGER, ROLES.LEAD]);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an employee on admin routes', () => {
    const next = call(ROLES.EMPLOYEE, [ROLES.ADMIN]);
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
  });

  it('rejects a missing session role', () => {
    const next = call(undefined, [ROLES.ADMIN]);
    expect((next.mock.calls[0]?.[0] as AppError).code).toBe('FORBIDDEN');
  });
});
