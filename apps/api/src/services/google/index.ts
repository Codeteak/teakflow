import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, isGoogleConfigured } from '../../config/env';
import { COMPANY_SETTINGS_ID, CompanySettings } from '../../models/companySettings';
import { AppError } from '../../middlewares/errorHandler/index';
import { getCompanySettings } from '../settings/index';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

type GoogleState = { sub: string; typ: 'google_oauth' };

export type CreateMeetEventInput = {
  title: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails: string[];
};

export type CreateMeetEventResult = {
  eventId: string;
  meetUrl: string;
};

let createMeetEventOverride:
  ((input: CreateMeetEventInput) => Promise<CreateMeetEventResult>) | null = null;

export function setCreateMeetEventOverride(
  fn: ((input: CreateMeetEventInput) => Promise<CreateMeetEventResult>) | null,
) {
  createMeetEventOverride = fn;
}

export function requireGoogleConfig() {
  if (!isGoogleConfigured()) {
    throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google OAuth is not configured.');
  }
}

export function googleAuthorizeUrl(adminUserId: string) {
  requireGoogleConfig();
  const state = jwt.sign(
    { sub: adminUserId, typ: 'google_oauth' } satisfies GoogleState,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: '15m',
    },
  );
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function readGoogleOAuthState(state: string) {
  try {
    const payload = jwt.verify(state, env.JWT_ACCESS_SECRET) as Partial<GoogleState>;
    if (!payload.sub || payload.typ !== 'google_oauth') {
      throw new Error('invalid');
    }
    return payload.sub;
  } catch {
    throw new AppError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Try connecting again.',
    );
  }
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new AppError(
      502,
      'GOOGLE_TOKEN_FAILED',
      'Google could not issue an access token.',
    );
  }
  return data;
}

export async function exchangeGoogleCode(code: string) {
  requireGoogleConfig();
  const tokens = await tokenRequest({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  if (!tokens.refresh_token) {
    throw new AppError(
      400,
      'GOOGLE_REFRESH_MISSING',
      'Google did not return a refresh token. Disconnect the app in Google account settings and try again.',
    );
  }
  const profileResponse = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileResponse.json()) as { email?: string };
  await getCompanySettings();
  const row = await CompanySettings.findByPk(COMPANY_SETTINGS_ID);
  if (!row) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Company settings could not be loaded.');
  }
  row.googleRefreshToken = tokens.refresh_token;
  row.googleConnectedEmail = profile.email ?? null;
  await row.save();
  return row.toPublic();
}

export async function disconnectGoogle() {
  const row = await CompanySettings.findByPk(COMPANY_SETTINGS_ID);
  if (!row) {
    return;
  }
  row.googleRefreshToken = null;
  row.googleConnectedEmail = null;
  await row.save();
}

async function accessTokenFromRefresh(refreshToken: string) {
  requireGoogleConfig();
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  return tokens.access_token!;
}

function meetUrlFromEvent(event: {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}) {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }
  const meet = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri,
  );
  return meet?.uri ?? null;
}

export async function createMeetEvent(
  input: CreateMeetEventInput,
): Promise<CreateMeetEventResult> {
  if (createMeetEventOverride) {
    return createMeetEventOverride(input);
  }

  const settings = await CompanySettings.findByPk(COMPANY_SETTINGS_ID);
  if (!settings?.googleRefreshToken) {
    throw new AppError(
      503,
      'GOOGLE_NOT_CONNECTED',
      'An admin must connect the company Google account first.',
    );
  }

  const accessToken = await accessTokenFromRefresh(settings.googleRefreshToken);
  const response = await fetch(`${CALENDAR_EVENTS}?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: input.title,
      start: { dateTime: input.startTime.toISOString() },
      end: { dateTime: input.endTime.toISOString() },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  });
  const event = (await response.json()) as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    error?: { message?: string };
  };
  const meetUrl = meetUrlFromEvent(event);
  if (!response.ok || !event.id || !meetUrl) {
    throw new AppError(
      502,
      'GOOGLE_MEET_FAILED',
      event.error?.message ?? 'Google Meet could not be created.',
    );
  }
  return { eventId: event.id, meetUrl };
}
