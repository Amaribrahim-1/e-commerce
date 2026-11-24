import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import { sendSuccess } from './common/sendSuccess.js';
import { notFoundHandler } from './common/notFoundHandler.js';
import { globalErrorHandler } from './common/globalErrorHandler.js';

export const app = express();

// Number of reverse proxies in front of the app (0 = none). It decides what
// req.ip is, which the rate limiter will rely on later (P2-T08).
app.set('trust proxy', config.trustProxyHops);

// Request log in development only; first, so it sees every request, including
// the ones rejected by the middlewares below. Production logging comes later.
if (config.env === 'development') {
  app.use(morgan('dev'));
}

// Security headers next, so every response (including errors and 404s) has them.
app.use(helmet());

// CORS allow-list from config. Not listed => no Access-Control-Allow-Origin
// header, so the browser blocks the response. Credentials stay off until the
// auth token transport (header vs cookie) is decided in Phase 2.
// A "*" inside the array is just a string to the cors package, not a wildcard,
// so it is mapped to the real wildcard here (config rejects it in production).
app.use(
  cors({
    origin: config.cors.origins.includes('*') ? '*' : config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);

// Reject oversized JSON bodies early (413) instead of buffering them in memory.
app.use(express.json({ limit: config.bodyLimit }));

app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, 200, null);
});

app.use(notFoundHandler);
app.use(globalErrorHandler);
