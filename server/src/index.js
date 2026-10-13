import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { cleanupExpired, cleanupSessions } from './lib/cleanup.js';
import { pool } from './lib/db.js';
import { ensureStorage } from './lib/files.js';
import { identityMiddleware } from './middleware/identity.js';
import { ownerMiddleware } from './middleware/owner.js';
import { authRouter } from './routes/auth.js';
import { filesRouter } from './routes/files.js';

await ensureStorage();

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(
  helmet({
    // HSTS only makes sense once the site is served over HTTPS.
    strictTransportSecurity: config.env === 'production' && config.publicUrl.startsWith('https://'),
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
if (config.corsOrigin) {
  app.use(cors({ origin: config.corsOrigin.split(','), allowedHeaders: ['X-Owner-Token', 'Content-Type'], credentials: true, exposedHeaders: ['Content-Disposition'] }));
}

const limiter = (max) =>
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  });

app.use('/api', limiter(config.rateLimit.max), express.json({ limit: '10kb' }), ownerMiddleware, identityMiddleware);
app.post('/api/files', limiter(config.rateLimit.uploadMax));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', (_req, res) =>
  res.json({
    maxFileSize: config.maxFileSize,
    maxFiles: config.maxFilesPerRequest,
    allowedExtensions: [...config.allowedExtensions].sort(),
    expiryHours: config.expiryHours,
    publicUrl: config.publicUrl || null,
  }),
);
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));

// Serve built frontend (production).
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status && err.code) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid request.' } });
  }
  console.error(err); // log internally, never expose
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on the server.' } });
});

await pool.query('SELECT 1'); // fail fast if DB is unreachable

const server = app.listen(config.port, config.host, () => {
  console.log(`QuickShare API listening on http://${config.host}:${config.port}`);
});

if (config.cleanupIntervalMinutes) {
  const run = () => Promise.all([cleanupExpired(), cleanupSessions()]).catch((e) => console.error('cleanup error', e.code || e.message));
  run();
  setInterval(run, config.cleanupIntervalMinutes * 60_000).unref();
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => pool.end().finally(() => process.exit(0))));
}
