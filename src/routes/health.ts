/**
 * Health check endpoint
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { HealthResponse } from '../types.js';

/** App start time for uptime calculation */
const startTime = Date.now();

/** Package version (loaded once) */
const version = '1.0.0';

/**
 * Register health check routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check endpoint
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    return reply.status(200).send(response);
  });

  /**
   * GET /ready
   * Readiness check (for Kubernetes-style deployments)
   */
  fastify.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Could add database connectivity check here
    return reply.status(200).send({ ready: true });
  });

  /**
   * GET /live
   * Liveness check (for Kubernetes-style deployments)
   */
  fastify.get('/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ live: true });
  });
}
