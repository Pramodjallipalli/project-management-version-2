import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { projectRouter } from './routes/project.routes';
import { userRouter } from './routes/user.routes';
import { workItemRouter } from './routes/work-item.routes';
import { formRouter } from './routes/form.routes';
import { organizationRouter } from './routes/organization.routes';
import { notificationRouter } from './routes/notification.routes';
import { timesheetRouter } from './routes/timesheet.routes';
import { cohortRouter } from './routes/cohort.routes';
import { actionItemRouter } from './routes/action-item.routes';
import { bugRouter } from './routes/bug.routes';

import { prisma, getSanitizedDatabaseInfo } from './lib/prisma';
import { getRedisConfig, testRedisConnection } from './lib/redis';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = performance.now();
  (req as any)._reqStartTime = start;

  const originalEnd = res.end;
  (res as any).end = function (this: any, ...args: any[]) {
    const totalMs = performance.now() - start;
    const authMs = (req as any)._authDuration || 0;
    const authDbMs = (req as any)._authDbDuration || 0;

    if (!res.headersSent) {
      res.setHeader(
        'Server-Timing',
        `total;dur=${totalMs.toFixed(1)}, auth;dur=${authMs.toFixed(1)}, db;dur=${authDbMs.toFixed(1)}`
      );
    }
    return originalEnd.apply(this, args);
  };

  res.on('finish', () => {
    const totalMs = performance.now() - start;
    const authMs = (req as any)._authDuration || 0;
    const authDbMs = (req as any)._authDbDuration || 0;

    // Structured timing log: never logs tokens, credentials, or sensitive data
    console.log(
      `[Timing] ${req.method} ${req.originalUrl || req.url} | ${res.statusCode} | total: ${totalMs.toFixed(1)}ms | auth: ${authMs.toFixed(1)}ms (db: ${authDbMs.toFixed(1)}ms)`
    );
  });

  next();
});

// Diagnostic Health Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  const redisConfig = getRedisConfig();
  const redisHealth = redisConfig.isConfigured
    ? await testRedisConnection()
    : { connected: false, error: 'REDIS_URL not configured', url: redisConfig.maskedUrl };

  res.status(200).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      ...getSanitizedDatabaseInfo(),
    },
    redis: {
      configured: redisConfig.isConfigured,
      connected: redisHealth.connected,
      url: redisConfig.maskedUrl,
      mode: redisHealth.connected ? 'async_queue' : 'synchronous_fallback',
      ...(redisHealth.latencyMs !== undefined ? { latency_ms: redisHealth.latencyMs } : {}),
      ...(redisHealth.error ? { error: redisHealth.error } : {}),
    },
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/users', userRouter);
app.use('/api/work-items', workItemRouter);
app.use('/api/forms', formRouter);
app.use('/api/organizations', organizationRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/timesheet', timesheetRouter);
app.use('/api/cohorts', cohortRouter);
app.use('/api/action-items', actionItemRouter);
app.use('/api/projects/:projectId/bugs', bugRouter);
app.use('/api/bugs', bugRouter);

// JSON 404 catch-all
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global JSON error handler
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export { app };
export default app;
