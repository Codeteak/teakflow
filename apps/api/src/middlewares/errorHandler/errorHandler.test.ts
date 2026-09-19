import { describe, expect, it } from 'vitest';
import { AppError, errorHandler } from './index';
import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('errorHandler mapping', () => {
  it('maps AppError', () => {
    const res = mockRes();
    errorHandler(new AppError(409, 'ALREADY_SUBMITTED', 'Already submitted.'), {} as Request, res, () => undefined);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: { code: 'ALREADY_SUBMITTED' } });
  });

  it('maps ZodError', () => {
    const res = mockRes();
    const parsed = z.object({ name: z.string().min(2) }).safeParse({ name: 'a' });
    expect(parsed.success).toBe(false);
    errorHandler(parsed.error as ZodError, {} as Request, res, () => undefined);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('maps unknown errors to INTERNAL_ERROR', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), {} as Request, res, () => undefined);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});
