import { createServer } from 'node:http';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { connectStorage } from './config/cloudinary';
import { connectRedis } from './config/redis';
import { connectMeili } from './config/meilisearch';
import { reindexChatSearch } from './services/search/index';
import { User } from './models/user';
import { syncModels } from './models/index';
import { ensureDefaultChannels } from './services/chat/index';
import { ensureCompanyIds } from './services/users/companyId';
import { app } from './app';
import { attachSockets } from './sockets/index';
import { runDailyWorkReminders } from './services/dailyWork/reminders';
import { runMeetingReminders } from './services/meetings/reminders';

const httpServer = createServer(app);
attachSockets(httpServer);

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Stop the other process, then run pnpm dev again.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Teakflow API listening on http://localhost:${env.PORT}`);
});

try {
  const dbOk = await connectDatabase();
  if (dbOk) {
    await syncModels();
    await ensureCompanyIds();
    const firstAdmin = await User.findOne({ order: [['createdAt', 'ASC']] });
    if (firstAdmin) {
      await ensureDefaultChannels(firstAdmin.id);
    }
    let remindersRunning = false;
    setInterval(() => {
      if (remindersRunning) {
        return;
      }
      remindersRunning = true;
      void runDailyWorkReminders()
        .catch((error) => {
          console.error('Daily work reminder job failed:', error);
        })
        .finally(() => {
          remindersRunning = false;
        });
      void runMeetingReminders().catch((error) => {
        console.error('Meeting reminder job failed:', error);
      });
    }, 60_000);
    void runDailyWorkReminders().catch((error) => {
      console.error('Daily work reminder job failed:', error);
    });
    void runMeetingReminders().catch((error) => {
      console.error('Meeting reminder job failed:', error);
    });
  }
  const storageOk = await connectStorage();
  const redisOk = await connectRedis();
  const meiliOk = await connectMeili();
  if (meiliOk) {
    void reindexChatSearch().catch((error) => {
      console.error('Meilisearch reindex failed:', error);
    });
  }

  console.log(`Supabase Postgres: ${dbOk ? 'connected' : 'not connected (set DATABASE_URL)'}`);
  console.log(`Cloudinary: ${storageOk ? 'connected' : 'not connected (set CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)'}`);
  console.log(`Redis: ${redisOk ? 'connected' : 'not connected (start with pnpm redis:up)'}`);
  console.log(`Meilisearch: ${meiliOk ? 'connected' : 'not connected (start with pnpm redis:up)'}`);
} catch (error) {
  console.error('API started, but a startup service failed:', error);
}
