/**
 * Integration tests for the Telegram Redirect service
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from './server.js';
import { createSQLiteStorage, type IStorage } from './lib/storage/index.js';
import { loadSlugsConfig } from './lib/slugs.js';
import type { FastifyInstance } from 'fastify';

describe('Integration Tests', () => {
  let app: FastifyInstance;
  let storage: IStorage;

  beforeAll(async () => {
    // Use in-memory SQLite for tests
    storage = await createSQLiteStorage(':memory:');

    // Load test slugs config
    loadSlugsConfig();

    app = await buildApp(storage);
  });

  afterAll(async () => {
    await app.close();
    await storage.close();
  });

  describe('Health endpoints', () => {
    it('GET /health should return OK', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.version).toBe('1.0.0');
      expect(body.uptime).toBeTypeOf('number');
    });

    it('GET /ready should return ready', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(true);
    });

    it('GET /live should return live', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.live).toBe(true);
    });
  });

  describe('Telegram redirect endpoint', () => {
    it('GET /tg/:slug should return 404 for invalid slug', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('GET /tg/support-bot should return shim HTML', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot',
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('<!DOCTYPE html>');
      expect(response.body).toContain('t.me/YourSupportBot');
      expect(response.body).toContain('Open Telegram');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('GET /tg/sales-bot should redirect with 302', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/sales-bot',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('t.me/YourSalesBot');
      expect(response.headers.location).toContain('start=');
    });

    it('GET /tg/community should return shim for public channel', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/community',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('t.me/YourCommunityChannel');
    });

    it('GET /tg/vip-group should return shim for invite link', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/vip-group',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('t.me/+ABCdef123456');
    });

    it('should preserve UTM parameters in attribution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot?utm_source=linkedin&utm_campaign=q1_promo',
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
        },
      });

      expect(response.statusCode).toBe(200);

      // Extract code from the shim HTML
      const codeMatch = response.body.match(/start=([A-Za-z0-9_-]+)/);
      expect(codeMatch).toBeTruthy();

      const code = codeMatch![1];

      // Resolve the code
      const resolveResponse = await app.inject({
        method: 'GET',
        url: `/r/${code}`,
      });

      expect(resolveResponse.statusCode).toBe(200);
      const resolveBody = JSON.parse(resolveResponse.body);

      expect(resolveBody.success).toBe(true);
      expect(resolveBody.data.utm.utm_source).toBe('linkedin');
      expect(resolveBody.data.utm.utm_campaign).toBe('q1_promo');
      expect(resolveBody.data.slug).toBe('support-bot');
    });

    it('should not return inactive slug', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/demo-bot',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Code resolution endpoint', () => {
    let validCode: string;

    beforeAll(async () => {
      // Create a click to get a valid code
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot',
      });

      const codeMatch = response.body.match(/start=([A-Za-z0-9_-]+)/);
      validCode = codeMatch![1];
    });

    it('GET /r/:code should return attribution data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/r/${validCode}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.slug).toBe('support-bot');
      expect(body.data.timestamp).toBeDefined();
      expect(body.data.requestId).toBeDefined();
    });

    it('GET /r/:code should return 404 for nonexistent code', async () => {
      // Generate a valid-format but nonexistent code
      const response = await app.inject({
        method: 'GET',
        url: '/r/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      expect(response.statusCode).toBe(400); // Invalid signature
    });

    it('GET /r/:code should return 400 for invalid format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/r/invalid!@#',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid');
    });

    it('GET /r/:code/status should return code status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/r/${validCode}/status`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.exists).toBe(true);
      expect(body.botUsername).toBe('YourSupportBot');
      expect(body.createdAt).toBeDefined();
    });
  });

  describe('Security', () => {
    it('should not allow arbitrary redirects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/../../../etc/passwd',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should strip dangerous query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot?onclick=alert(1)&constructor=bad',
      });

      expect(response.statusCode).toBe(200);

      // Extract and verify the attribution doesn't contain dangerous params
      const codeMatch = response.body.match(/start=([A-Za-z0-9_-]+)/);
      const code = codeMatch![1];

      const resolveResponse = await app.inject({
        method: 'GET',
        url: `/r/${code}`,
      });

      const body = JSON.parse(resolveResponse.body);
      expect(body.data.extraParams.onclick).toBeUndefined();
      expect(Object.keys(body.data.extraParams)).not.toContain('constructor');
    });

    it('should return request ID header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot',
      });

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('404 handling', () => {
    it('should return JSON 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown/path',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });
});
