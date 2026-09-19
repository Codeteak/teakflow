import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

redis.on('error', () => {
  // Redis is optional during Phase 0 local preview.
});

export async function connectRedis(): Promise<boolean> {
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
