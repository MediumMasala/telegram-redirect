/**
 * Code resolution route
 * GET /r/:code
 *
 * Returns the attribution data for a given code
 * Used by Telegram bots to retrieve attribution context
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { isValidCodeFormat, validateCode } from '../lib/code.js';
import { createCodeCache } from '../lib/cache.js';
import { config } from '../config.js';
import type { IStorage } from '../lib/storage/index.js';
import type { ResolveResponse, CodeMapping, ICache } from '../types.js';

interface ResolveRouteParams {
  code: string;
}

interface ResolveRouteContext {
  storage: IStorage;
}

/** LRU cache for hot code lookups */
let codeCache: ICache<CodeMapping> | null = null;

/**
 * Get or create the code cache
 */
function getCodeCache(): ICache<CodeMapping> {
  if (!codeCache) {
    codeCache = createCodeCache(1000, 5 * 60 * 1000); // 1000 entries, 5 min TTL
  }
  return codeCache;
}

/**
 * Register code resolution routes
 */
export async function resolveRoutes(
  fastify: FastifyInstance,
  opts: ResolveRouteContext
): Promise<void> {
  const { storage } = opts;
  const cache = getCodeCache();

  /**
   * GET /r/:code
   * Resolve a code to its attribution data
   */
  fastify.get<{
    Params: ResolveRouteParams;
  }>('/r/:code', async (request: FastifyRequest<{
    Params: ResolveRouteParams;
  }>, reply: FastifyReply) => {
    const { code } = request.params;

    // Quick format validation
    if (!isValidCodeFormat(code)) {
      request.log.warn({ code: code.slice(0, 20) }, 'Invalid code format');
      return reply.status(400).send({
        success: false,
        error: 'Invalid code format',
      } satisfies ResolveResponse);
    }

    // Validate code signature
    if (!validateCode(code)) {
      request.log.warn({ code: code.slice(0, 20) }, 'Invalid code signature');
      return reply.status(400).send({
        success: false,
        error: 'Invalid code',
      } satisfies ResolveResponse);
    }

    // Check cache first
    let mapping: CodeMapping | null | undefined = cache.get(code);

    if (!mapping) {
      // Fetch from storage
      try {
        mapping = await storage.getCode(code);
      } catch (err) {
        request.log.error({ err, code: code.slice(0, 20) }, 'Failed to fetch code');
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        } satisfies ResolveResponse);
      }
    }

    if (!mapping) {
      request.log.info({ code: code.slice(0, 20) }, 'Code not found');
      return reply.status(404).send({
        success: false,
        error: 'Code not found',
      } satisfies ResolveResponse);
    }

    // Update cache
    cache.set(code, mapping);

    // Mark as resolved if not already
    if (!mapping.resolved) {
      try {
        await storage.markResolved(code);
        mapping.resolved = true;
        mapping.resolvedAt = new Date().toISOString();
        cache.set(code, mapping); // Update cache with resolved status
      } catch (err) {
        request.log.error({ err, code: code.slice(0, 20) }, 'Failed to mark code as resolved');
        // Continue - this is not critical
      }
    }

    // One-time code: delete after resolution
    if (config.oneTimeCodes && !mapping.resolved) {
      try {
        await storage.deleteCode(code);
        cache.delete(code);
        request.log.info({ code: code.slice(0, 20) }, 'One-time code deleted');
      } catch (err) {
        request.log.error({ err, code: code.slice(0, 20) }, 'Failed to delete one-time code');
      }
    }

    request.log.info(
      {
        code: code.slice(0, 20),
        slug: mapping.attribution.slug,
        wasResolved: mapping.resolved,
      },
      'Code resolved'
    );

    return reply.status(200).send({
      success: true,
      data: mapping.attribution,
    } satisfies ResolveResponse);
  });

  /**
   * GET /r/:code/status
   * Check if a code exists and its resolution status
   * Useful for bots to check if they should expect attribution data
   */
  fastify.get<{
    Params: ResolveRouteParams;
  }>('/r/:code/status', async (request: FastifyRequest<{
    Params: ResolveRouteParams;
  }>, reply: FastifyReply) => {
    const { code } = request.params;

    if (!isValidCodeFormat(code)) {
      return reply.status(400).send({ valid: false });
    }

    if (!validateCode(code)) {
      return reply.status(400).send({ valid: false });
    }

    // Check cache first
    let mapping: CodeMapping | null | undefined = cache.get(code);

    if (!mapping) {
      try {
        mapping = await storage.getCode(code);
      } catch {
        return reply.status(500).send({ valid: false, error: 'Internal error' });
      }
    }

    if (!mapping) {
      return reply.status(404).send({ exists: false });
    }

    return reply.status(200).send({
      exists: true,
      resolved: mapping.resolved,
      createdAt: mapping.createdAt,
      resolvedAt: mapping.resolvedAt,
      botUsername: mapping.botUsername,
    });
  });
}
