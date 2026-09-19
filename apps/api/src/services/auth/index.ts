import { createHash, randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { SessionUser } from '@teakflow/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ACCOUNT_RESTRICTED_MESSAGE, loginSchema, USER_STATUS } from '@teakflow/shared';
import { env } from '../../config/env';
import { RefreshToken } from '../../models/refreshToken';
import { User } from '../../models/user';
import { AppError } from '../../middlewares/errorHandler/index';

export const ACCESS_COOKIE = 'teakflow_access';
export const REFRESH_COOKIE = 'teakflow_refresh';
/** @deprecated Use ACCESS_COOKIE. Kept so existing browsers stay signed in until refresh. */
export const SESSION_COOKIE = ACCESS_COOKIE;

export const ACCESS_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const REFRESH_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;

const crossSiteFrontend =
  env.NODE_ENV === 'production' &&
  !/localhost|127\.0\.0\.1/i.test(env.CLIENT_ORIGIN);

const baseCookie: CookieOptions = {
  httpOnly: true,
  // Vercel (frontend) + Railway (API) need cross-site cookies.
  sameSite: crossSiteFrontend ? 'none' : 'lax',
  secure: crossSiteFrontend || env.NODE_ENV === 'production',
  path: '/',
};

export const accessCookieOptions: CookieOptions = {
  ...baseCookie,
  maxAge: ACCESS_MAX_AGE_MS,
};

export const refreshCookieOptions: CookieOptions = {
  ...baseCookie,
  maxAge: REFRESH_MAX_AGE_MS,
};

export const sessionCookieOptions = accessCookieOptions;

type AccessPayload = { sub: string; typ: 'access' };
type RefreshPayload = { sub: string; typ: 'refresh'; jti: string };

function hashTokenId(jti: string) {
  return createHash('sha256').update(jti).digest('hex');
}

export function signAccessToken(userId: string) {
  return jwt.sign(
    { sub: userId, typ: 'access' } satisfies AccessPayload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signSession(userId: string) {
  return signAccessToken(userId);
}

export function signRefreshToken(userId: string, jti: string) {
  return jwt.sign(
    { sub: userId, typ: 'refresh', jti } satisfies RefreshPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function readSession(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<AccessPayload>;
    if (!payload.sub || (payload.typ && payload.typ !== 'access')) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
}

function readRefresh(token: string): RefreshPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as Partial<RefreshPayload>;
    if (!payload.sub || payload.typ !== 'refresh' || !payload.jti) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    return { sub: payload.sub, typ: 'refresh', jti: payload.jti };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
}

export async function revokeRefreshTokensForUser(userId: string) {
  await RefreshToken.destroy({ where: { userId } });
}

export async function persistRefreshToken(userId: string, jti: string) {
  await RefreshToken.create({
    userId,
    tokenHash: hashTokenId(jti),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
  });
}

export async function issueAuthCookies(res: Response, userId: string) {
  const jti = randomUUID();
  await persistRefreshToken(userId, jti);
  res.cookie(ACCESS_COOKIE, signAccessToken(userId), accessCookieOptions);
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId, jti), refreshCookieOptions);
  res.clearCookie('teakflow_session', { ...baseCookie, maxAge: undefined });
}

export async function rotateRefreshCookies(res: Response, refreshToken: string) {
  const payload = readRefresh(refreshToken);
  const tokenHash = hashTokenId(payload.jti);
  const stored = await RefreshToken.findOne({
    where: { tokenHash, userId: payload.sub },
  });
  if (!stored || stored.expiresAt.getTime() <= Date.now()) {
    if (stored) {
      await stored.destroy();
    }
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  await stored.destroy();
  await getSessionUser(payload.sub);
  await issueAuthCookies(res, payload.sub);
  return payload.sub;
}

export async function revokeRefreshToken(refreshToken: string | undefined) {
  if (!refreshToken) {
    return;
  }
  try {
    const payload = readRefresh(refreshToken);
    // Drop every refresh token for this user so other tabs cannot revive the session.
    await RefreshToken.destroy({ where: { userId: payload.sub } });
  } catch {
    return;
  }
}

export function clearAuthCookies(res: Response) {
  const clearOptions: CookieOptions = {
    httpOnly: true,
    sameSite: crossSiteFrontend ? 'none' : 'lax',
    secure: crossSiteFrontend || env.NODE_ENV === 'production',
    path: '/',
  };
  res.clearCookie(ACCESS_COOKIE, clearOptions);
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  res.clearCookie('teakflow_session', clearOptions);
}

export async function loginWithPassword(input: unknown): Promise<SessionUser> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_CREDENTIALS', 'Enter a valid email and password.');
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, 'ACCOUNT_RESTRICTED', ACCOUNT_RESTRICTED_MESSAGE);
  }

  user.lastSeenAt = new Date();
  await user.save();
  return user.toSession();
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, 'ACCOUNT_RESTRICTED', ACCOUNT_RESTRICTED_MESSAGE);
  }
  return user.toSession();
}
