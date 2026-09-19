import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

/** General API protection — generous for chat/polling. */
export const apiRateLimit: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again in a minute.',
    },
  },
});

/** Stricter limit for auth endpoints (login, refresh). */
export const authRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many sign-in attempts. Wait a few minutes and try again.',
    },
  },
});
