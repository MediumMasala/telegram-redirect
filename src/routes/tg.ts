/**
 * Telegram redirect route
 * GET /tg/:slug
 *
 * Handles LinkedIn ad clicks and redirects to Telegram
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSlugConfig } from '../lib/slugs.js';
import { generateCode } from '../lib/code.js';
import { generateShimHtml, getDirectRedirectUrl } from '../lib/shim.js';
import { parseUserAgent, isBot } from '../lib/ua.js';
import {
  generateRequestId,
  hashIp,
  getClientIp,
  extractUtmParams,
  extractExtraParams,
} from '../lib/utils.js';
import type { IStorage } from '../lib/storage/index.js';
import type { ClickAttribution, CodeMapping, ClickLog } from '../types.js';

interface TgRouteParams {
  slug: string;
}

interface TgRouteContext {
  storage: IStorage;
}

/**
 * Register Telegram redirect routes
 */
export async function tgRoutes(
  fastify: FastifyInstance,
  opts: TgRouteContext
): Promise<void> {
  const { storage } = opts;

  /**
   * GET /tg/:slug
   * Main redirect endpoint
   */
  fastify.get<{
    Params: TgRouteParams;
    Querystring: Record<string, string>;
  }>('/tg/:slug', async (request: FastifyRequest<{
    Params: TgRouteParams;
    Querystring: Record<string, string>;
  }>, reply: FastifyReply) => {
    const { slug } = request.params;
    const query = request.query;
    const requestId = generateRequestId();

    // Add request ID to response headers for debugging
    reply.header('X-Request-ID', requestId);

    // Get slug configuration
    const slugConfig = getSlugConfig(slug);

    if (!slugConfig) {
      request.log.warn({ slug, requestId }, 'Slug not found or inactive');
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invalid or inactive redirect link',
      });
    }

    // Parse request metadata
    const userAgent = request.headers['user-agent'] ?? '';
    const clientIp = getClientIp(request.headers as Record<string, string | string[] | undefined>);
    const ipHash = hashIp(clientIp);
    const device = parseUserAgent(userAgent);
    const utmParams = extractUtmParams(query);
    const extraParams = extractExtraParams(query);
    const timestamp = new Date().toISOString();

    // Check if this is a bot/crawler
    if (isBot(userAgent)) {
      request.log.info({ slug, requestId, userAgent }, 'Bot request detected');
      // For bots, return a minimal response or shim page
      // This helps with link previews
    }

    let redirectTarget: string;
    let code: string | undefined;

    // Handle based on destination type
    if (slugConfig.type === 'bot') {
      // Generate a code for attribution tracking
      code = generateCode();

      // Build attribution data
      const attribution: ClickAttribution = {
        slug,
        timestamp,
        utm: utmParams,
        extraParams,
        ipHash,
        userAgent,
        device,
        requestId,
      };

      // Store the code mapping
      const mapping: CodeMapping = {
        code,
        attribution,
        botUsername: slugConfig.destination,
        createdAt: timestamp,
        resolved: false,
      };

      try {
        await storage.storeCode(mapping);
        request.log.info({ slug, requestId, code }, 'Code generated and stored');
      } catch (err) {
        request.log.error({ err, slug, requestId }, 'Failed to store code mapping');
        // Continue anyway - redirect still works, just no attribution
      }

      // Build redirect target
      redirectTarget = getDirectRedirectUrl('bot', slugConfig.destination, code);
    } else {
      // Public or invite - no code needed
      redirectTarget = getDirectRedirectUrl(slugConfig.type, slugConfig.destination);
    }

    // Log the click
    const clickLog: ClickLog = {
      requestId,
      slug,
      timestamp,
      ipHash,
      userAgent,
      redirectTarget,
      code,
      queryParams: { ...utmParams, ...extraParams },
    };

    try {
      await storage.logClick(clickLog);
    } catch (err) {
      request.log.error({ err, slug, requestId }, 'Failed to log click');
      // Continue anyway
    }

    request.log.info(
      {
        slug,
        requestId,
        mode: slugConfig.mode,
        type: slugConfig.type,
        device: device.type,
        hasCode: !!code,
      },
      'Processing redirect'
    );

    // Return response based on mode
    if (slugConfig.mode === '302') {
      // Direct redirect
      return reply.redirect(302, redirectTarget);
    } else {
      // Shim page
      const html = generateShimHtml({
        type: slugConfig.type,
        destination: slugConfig.destination,
        startParam: code,
        title: slugConfig.description || 'Opening Telegram...',
        description: 'Click the button below if Telegram doesn\'t open automatically.',
        fallbackDelay: 1000,
      });

      return reply
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate')
        .send(html);
    }
  });

  /**
   * GET /tg
   * List available slugs (development only)
   */
  fastify.get('/tg', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Only in development
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const { getAllActiveSlugs } = await import('../lib/slugs.js');
    const slugs = getAllActiveSlugs();

    return reply.status(200).send({
      message: 'Available redirect slugs (development only)',
      slugs: slugs.map((s) => ({
        slug: s.slug,
        type: s.type,
        mode: s.mode,
        destination: s.destination,
        description: s.description,
        url: `/tg/${s.slug}`,
      })),
    });
  });
}
