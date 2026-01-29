/**
 * Telegram Redirect & Attribution Service
 * Main server entry point
 */

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { loadSlugsConfig } from './lib/slugs.js';
import { createSQLiteStorage, type IStorage } from './lib/storage/index.js';
import { healthRoutes } from './routes/health.js';
import { tgRoutes } from './routes/tg.js';
import { resolveRoutes } from './routes/resolve.js';

/**
 * Build the Fastify application
 */
export async function buildApp(storage?: IStorage) {
  // Validate config in production
  config.validate();

  // Load slugs configuration
  loadSlugsConfig();

  // Create storage instance if not provided
  const storageInstance = storage ?? await createSQLiteStorage();

  // Create Fastify instance
  // Note: pino-pretty is only used in development and should be installed as devDependency
  let loggerTransport: { target: string; options: Record<string, unknown> } | undefined;

  // Only use pino-pretty in development when it's available
  if (config.isDevelopment) {
    try {
      // Check if pino-pretty is available
      await import('pino-pretty');
      loggerTransport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      };
    } catch {
      // pino-pretty not available, use default JSON logging
    }
  }

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: loggerTransport,
    },
    trustProxy: true, // Trust X-Forwarded-* headers
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');

    // Don't expose internal errors in production
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

  // Register rate limiting for resolve endpoint
  await app.register(rateLimit, {
    max: config.resolveRateLimit,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate limit by IP
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
    // Only apply to /r/* routes
    allowList: (request) => !request.url.startsWith('/r/'),
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(tgRoutes, { storage: storageInstance });
  await app.register(resolveRoutes, { storage: storageInstance });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    try {
      await app.close();
      await storageInstance.close();
      app.log.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return app;
}

/**
 * Start the server
 */
async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`Server listening on http://${config.host}:${config.port}`);
    app.log.info(`Environment: ${config.nodeEnv}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server if this is the main module
// This check works with both ESM and when compiled
function checkIsMain(): boolean {
  try {
    const scriptPath = process.argv[1];
    if (!scriptPath) return false;

    // Normalize paths for comparison
    const moduleUrl = import.meta.url;
    const scriptUrl = `file://${scriptPath}`;

    // Check direct match or match with .js extension
    return moduleUrl === scriptUrl ||
           moduleUrl === scriptUrl.replace(/\.ts$/, '.js') ||
           moduleUrl.replace(/\.js$/, '') === scriptUrl.replace(/\.js$/, '');
  } catch {
    return false;
  }
}

if (checkIsMain()) {
  start();
}

export { start };
