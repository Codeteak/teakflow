import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// tsc emit lives in dist/config; esbuild bundle is dist/index.js
const bundled = path.basename(here) === 'dist';
const apiRoot = bundled ? path.resolve(here, '..') : path.resolve(here, '../..');
const workspaceRoot = bundled ? path.resolve(here, '../..') : path.resolve(here, '../../..');

const envFiles = [
  path.join(apiRoot, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.join(workspaceRoot, '.env'),
];

for (const file of envFiles) {
  if (existsSync(file)) {
    // Do not override existing process env (Railway/Docker inject PORT, secrets, etc.).
    loadEnv({ path: file, override: false });
    if (!process.env.GOOGLE_SALES_SA_JSON) {
      const json = extractMultilineEnvValue(file, 'GOOGLE_SALES_SA_JSON');
      if (json) {
        process.env.GOOGLE_SALES_SA_JSON = json;
      }
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3005),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  CLOUD_NAME: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MEILI_HOST: z.string().default('http://127.0.0.1:7700'),
  MEILI_MASTER_KEY: z.string().default('teakflow-dev-master-key'),
  JWT_ACCESS_SECRET: z.string().default('change-me-access'),
  JWT_REFRESH_SECRET: z.string().default('change-me-refresh'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('3h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('31d'),
  COMPANY_TIMEZONE: z.string().default('Asia/Kolkata'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default('http://localhost:3005/api/v1/auth/google/callback'),
  GOOGLE_SALES_SA_JSON: z.string().default(''),
  GOOGLE_SALES_FOLDER_ID: z.string().default(''),
  GOOGLE_SALES_SPREADSHEET_ID: z.string().default(''),
  GOOGLE_SALES_SPREADSHEET_IDS: z.string().default(''),
});

export const env = envSchema.parse(process.env);

function extractMultilineEnvValue(filePath: string, key: string) {
  const text = readFileSync(filePath, 'utf8');
  const token = `${key}=`;
  const start = text.indexOf(token);
  if (start < 0) {
    return '';
  }
  const rest = text.slice(start + token.length);
  if (rest.startsWith('{')) {
    const end = rest.indexOf('\nGOOGLE_');
    const block = (end >= 0 ? rest.slice(0, end) : rest).trim();
    try {
      JSON.parse(block);
      return block;
    } catch {
      return '';
    }
  }
  const line = rest.split(/\r?\n/, 1)[0] ?? '';
  const unquoted = line.replace(/^['"]|['"]$/g, '').trim();
  if (unquoted.startsWith('{')) {
    try {
      JSON.parse(unquoted);
      return unquoted;
    } catch {
      return '';
    }
  }
  return '';
}

export function isSupabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isGoogleConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isCloudinaryConfigured() {
  const cloudName = env.CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloudName && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}
