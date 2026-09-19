import type { SessionUser } from '@teakflow/shared';

export {};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: SessionUser;
    }
  }
}
