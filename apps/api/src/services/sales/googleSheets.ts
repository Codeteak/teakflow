import { createSign } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler/index';
import { salesWorkbookName } from '@teakflow/shared';

type ServiceAccount = { client_email: string; private_key: string };

let tokenCache: { token: string; exp: number } | null = null;
const workbookCache = new Map<number, { id: string; name: string; exp: number }>();
const tabCache = new Map<string, { titles: string[]; exp: number }>();

const WORKBOOK_TTL_MS = 10 * 60 * 1000;
const TAB_TTL_MS = 10 * 60 * 1000;

function readServiceAccount(): ServiceAccount | null {
  const raw = env.GOOGLE_SALES_SA_JSON.trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function signJwt(email: string, key: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
    'base64url',
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope:
        'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key.replace(/\\n/g, '\n'), 'base64url');
  return `${header}.${payload}.${signature}`;
}

async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const sa = readServiceAccount();
  if (!sa?.client_email || !sa.private_key) {
    throw new AppError(
      503,
      'SALES_SHEET_NOT_CONFIGURED',
      'Connect the yearly payment workbook in Drive first.',
    );
  }
  const assertion = signJwt(sa.client_email, sa.private_key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!data.access_token) {
    throw new AppError(
      503,
      'SALES_SHEET_NOT_CONFIGURED',
      'Google Drive login for sales failed. Check the service account.',
    );
  }
  const lifeMs = Math.max(60, (data.expires_in ?? 3600) - 120) * 1000;
  tokenCache = { token: data.access_token, exp: Date.now() + lifeMs };
  return data.access_token;
}

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function googleGet<T>(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      data.error?.message ?? 'Could not read the payment workbook.',
    );
  }
  return data;
}

async function convertExcelToSheet(file: { id: string; name: string }, token: string) {
  const folder = env.GOOGLE_SALES_FOLDER_ID.trim();
  const name = file.name.replace(/\.xlsx$/i, '').trim() || file.name;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/copy?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: SHEET_MIME,
        ...(folder ? { parents: [folder] } : {}),
      }),
    },
  );
  const data = (await response.json()) as {
    id?: string;
    name?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.id) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      data.error?.message ??
        'This workbook is still an Excel file. Open it with Google Sheets in Drive, then try again.',
    );
  }
  return { id: data.id, name: data.name ?? name };
}

async function googleWrite(url: string, token: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as {
    totalUpdatedCells?: number;
    error?: { message?: string; status?: string };
  };
  if (!response.ok) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      data.error?.message ?? 'Could not update the payment workbook.',
    );
  }
  return data;
}

export async function findYearWorkbook(year: number) {
  const cached = workbookCache.get(year);
  if (cached && cached.exp > Date.now()) {
    return { id: cached.id, name: cached.name };
  }
  const mapped = env.GOOGLE_SALES_SPREADSHEET_IDS.trim();
  if (mapped) {
    try {
      const ids = JSON.parse(mapped) as Record<string, string>;
      const id = ids[String(year)];
      if (id) {
        const file = { id, name: salesWorkbookName(year) };
        workbookCache.set(year, { ...file, exp: Date.now() + WORKBOOK_TTL_MS });
        return file;
      }
    } catch {
      /* use folder search */
    }
  }
  if (env.GOOGLE_SALES_SPREADSHEET_ID && year === new Date().getFullYear()) {
    const file = { id: env.GOOGLE_SALES_SPREADSHEET_ID, name: salesWorkbookName(year) };
    workbookCache.set(year, { ...file, exp: Date.now() + WORKBOOK_TTL_MS });
    return file;
  }
  const token = await accessToken();
  const name = salesWorkbookName(year);
  const folder = env.GOOGLE_SALES_FOLDER_ID.trim();
  const q = folder
    ? `'${folder}' in parents and name contains '${name}' and trashed = false`
    : `name contains '${name}' and trashed = false`;
  const result = await googleGet<{
    files?: { id: string; name: string; mimeType?: string }[];
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=25&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    token,
  );
  const files = result.files ?? [];
  let file =
    files.find((item) => item.mimeType === SHEET_MIME) ??
    files.find((item) => item.mimeType === EXCEL_MIME) ??
    files[0];
  if (!file?.id) {
    throw new AppError(
      404,
      'SALES_SHEET_MISSING',
      `No workbook named "${name}" in the Yaadro sales Drive folder. Add this year’s file (copy last year, keep month tabs).`,
    );
  }
  if (file.mimeType && file.mimeType !== SHEET_MIME) {
    file = await convertExcelToSheet({ id: file.id, name: file.name ?? name }, token);
  }
  const resolved = { id: file.id, name: file.name ?? name };
  workbookCache.set(year, { ...resolved, exp: Date.now() + WORKBOOK_TTL_MS });
  return resolved;
}

export async function listSheetTabs(spreadsheetId: string) {
  const cached = tabCache.get(spreadsheetId);
  if (cached && cached.exp > Date.now()) {
    return cached.titles;
  }
  const token = await accessToken();
  const data = await googleGet<{ sheets?: { properties?: { title?: string } }[] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    token,
  );
  const titles = (data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter(Boolean) as string[];
  tabCache.set(spreadsheetId, { titles, exp: Date.now() + TAB_TTL_MS });
  return titles;
}

export async function resolveSheetTab(spreadsheetId: string, wanted: string) {
  const titles = await listSheetTabs(spreadsheetId);
  const exact = titles.find((title) => title.toLowerCase() === wanted.toLowerCase());
  if (!exact) {
    throw new AppError(
      404,
      'SALES_SHEET_MISSING',
      `No month tab named "${wanted}" (any capitalization).`,
    );
  }
  return exact;
}

function quotedTab(tab: string) {
  return `'${tab.replace(/'/g, "''")}'`;
}

export async function readSheetValues(spreadsheetId: string, tab: string) {
  const title = await resolveSheetTab(spreadsheetId, tab);
  const token = await accessToken();
  const data = await googleGet<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedTab(title)}!A1:AZ10000`)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
    token,
  );
  return { title, values: data.values ?? [] };
}

export async function writeSheetCells(
  spreadsheetId: string,
  tab: string,
  updates: { range: string; values: string[][] }[],
) {
  const title = await resolveSheetTab(spreadsheetId, tab);
  const token = await accessToken();
  const data = await googleWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    token,
    {
      valueInputOption: 'RAW',
      includeValuesInResponse: true,
      data: updates.map((item) => ({
        range: `${quotedTab(title)}!${item.range}`,
        majorDimension: 'ROWS',
        values: item.values,
      })),
    },
  );
  if (data.totalUpdatedCells === 0) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      'Google Sheets accepted the request but did not change any cells.',
    );
  }
  return title;
}

export function isSalesSheetConfigured() {
  try {
    const sa = JSON.parse(env.GOOGLE_SALES_SA_JSON) as {
      client_email?: string;
      private_key?: string;
    };
    return Boolean(
      sa.client_email &&
      sa.private_key &&
      (env.GOOGLE_SALES_FOLDER_ID.trim() ||
        env.GOOGLE_SALES_SPREADSHEET_ID.trim() ||
        env.GOOGLE_SALES_SPREADSHEET_IDS.trim()),
    );
  } catch {
    return false;
  }
}
