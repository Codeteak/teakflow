import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler/index';
import { apiRateLimit } from './middlewares/rateLimit/index';
import { apiPrefix, router } from './routes/index';

export const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // Vercel frontend → Railway API is cross-origin; default same-origin CORP
    // makes browsers report "Failed to fetch" even when CORS allows the origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'https:'],
        'frame-src': ["'self'", 'https://res.cloudinary.com'],
      },
    },
  }),
);
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(apiPrefix, apiRateLimit, router);
app.use(errorHandler);
