import { Meilisearch } from 'meilisearch';
import { env } from './env';

export const meili = new Meilisearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
});

export function isMeiliConfigured() {
  return Boolean(env.MEILI_HOST && env.MEILI_MASTER_KEY);
}

export async function connectMeili(): Promise<boolean> {
  if (!isMeiliConfigured()) {
    return false;
  }
  try {
    const health = await meili.health();
    return health.status === 'available';
  } catch {
    return false;
  }
}
