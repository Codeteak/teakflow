import type { Request, Response, NextFunction } from 'express';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  getSessionUser,
  issueAuthCookies,
  loginWithPassword,
  revokeRefreshToken,
  rotateRefreshCookies,
} from '../../services/auth/index';
import { AppError } from '../../middlewares/errorHandler/index';
import {
  disconnectGoogle,
  exchangeGoogleCode,
  googleAuthorizeUrl,
  readGoogleOAuthState,
} from '../../services/google/index';
import { env } from '../../config/env';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loginWithPassword(req.body);
    await issueAuthCookies(res, user.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    clearAuthCookies(res);
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    await rotateRefreshCookies(res, token);
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    const user = await getSessionUser(req.userId);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

export async function startGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    res.redirect(googleAuthorizeUrl(req.userId));
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      throw new AppError(
        400,
        'GOOGLE_OAUTH_FAILED',
        'Google did not return a valid code.',
      );
    }
    readGoogleOAuthState(state);
    await exchangeGoogleCode(code);
    res.redirect(`${env.CLIENT_ORIGIN}/settings?google=connected`);
  } catch (error) {
    next(error);
  }
}

export async function disconnectGoogleAccount(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await disconnectGoogle();
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
}
