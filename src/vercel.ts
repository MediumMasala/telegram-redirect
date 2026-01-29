/**
 * Vercel Serverless Entry Point
 *
 * This file exports the Fastify app configured for Vercel's serverless environment.
 */

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { loadSlugsConfig } from './lib/slugs.js';
import { createMemoryStorage, createSQLiteStorage, type IStorage } from './lib/storage/index.js';
import { healthRoutes } from './routes/health.js';
import { tgRoutes } from './routes/tg.js';
import { resolveRoutes } from './routes/resolve.js';

/** Cached app instance for warm starts */
let cachedApp: ReturnType<typeof Fastify> | null = null;
let cachedStorage: IStorage | null = null;

/**
 * Determine which storage to use based on environment
 */
async function getStorage(): Promise<IStorage> {
  if (cachedStorage) return cachedStorage;

  // Check if we should use SQLite (for local dev or persistent storage)
  const useMemory = process.env.VERCEL === '1' || process.env.USE_MEMORY_STORAGE === 'true';

  if (useMemory) {
    console.log('Using in-memory storage (data will not persist across cold starts)');
    cachedStorage = await createMemoryStorage();
  } else {
    console.log('Using SQLite storage');
    cachedStorage = await createSQLiteStorage();
  }

  return cachedStorage;
}

/**
 * Build the Fastify application for Vercel
 */
export async function buildVercelApp() {
  if (cachedApp) return cachedApp;

  // Load slugs configuration
  loadSlugsConfig();

  // Get storage instance
  const storage = await getStorage();

  // Create Fastify instance optimized for serverless
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');
    const message = config.isProduction ? 'Internal Server Error' : error.message;
    reply.status(error.statusCode ?? 500).send({
      error: 'Error',
      message,
      statusCode: error.statusCode ?? 500,
    });
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url }, 'Route not found');
    reply.status(404).send({
      error: 'Not Found',
      message: 'The requested resource was not found',
      statusCode: 404,
    });
  });

  // Register rate limiting
  await app.register(rateLimit, {
    max: config.resolveRateLimit,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      }
      return request.ip;
    },
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    }),
    allowList: (request) => !request.url.startsWith('/r/'),
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(tgRoutes, { storage });
  await app.register(resolveRoutes, { storage });

  // Ready the app
  await app.ready();

  cachedApp = app;
  return app;
}

export default buildVercelApp;
