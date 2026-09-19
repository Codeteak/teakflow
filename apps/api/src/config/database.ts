import { Sequelize } from 'sequelize';
import { env } from './env';

const databaseUrl = env.DATABASE_URL;
const usesSupabase = databaseUrl.includes('supabase.co');
const usesTransactionPooler = /:(6543)(\/|$)/.test(databaseUrl);
const usesDirectDb = /\/\/db\.[^/]+\.supabase\.co/.test(databaseUrl);
const usesSessionPooler =
  databaseUrl.includes('pooler.supabase.com') && !usesTransactionPooler;

if (usesTransactionPooler) {
  console.warn(
    '[db] DATABASE_URL uses the transaction pooler (port 6543). Sequelize needs the Session pooler (port 5432) or Direct connection.',
  );
}

if (usesDirectDb) {
  console.warn(
    '[db] DATABASE_URL uses the Direct connection. Prefer the Session pooler (…pooler.supabase.com:5432) to avoid ECONNRESET / pool timeouts.',
  );
}

/**
 * Supabase closes idle TCP sockets aggressively on the Direct host. Keep the
 * Sequelize pool small, release idle clients quickly, and enable TCP keepAlive
 * so dead sockets are detected before acquire waits forever.
 */
const pool = usesSupabase
  ? {
      max: usesDirectDb ? 3 : 5,
      min: 0,
      acquire: 30_000,
      idle: 8_000,
      evict: 8_000,
    }
  : {
      max: 10,
      min: 0,
      acquire: 30_000,
      idle: 10_000,
      evict: 10_000,
    };

export const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      pool,
      retry: {
        max: 3,
      },
      dialectOptions: usesSupabase
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
            keepAlive: true,
          }
        : undefined,
    })
  : null;

export async function connectDatabase(): Promise<boolean> {
  if (!sequelize) {
    return false;
  }

  try {
    await sequelize.authenticate();
    if (usesSessionPooler) {
      console.log('[db] Connected via Supabase Session pooler');
    } else if (usesDirectDb) {
      console.log(
        '[db] Connected via Supabase Direct (consider switching to Session pooler)',
      );
    } else {
      console.log('[db] Connected');
    }
    return true;
  } catch (error) {
    console.error(
      '[db] authenticate failed:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
