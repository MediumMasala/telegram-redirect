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

    it('GET /tg/support-bot should return shim HTML for Android', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot',
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('<!DOCTYPE html>');
      expect(response.body).toContain('t.me/TalCareerBot');
      expect(response.body).toContain('Open Telegram');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('GET /tg/support-bot should 302 redirect for iOS', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot',
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('t.me/TalCareerBot');
    });

    it('GET /tg/sales-bot should redirect with 302', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/sales-bot',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('t.me/TalCareerBot');
      expect(response.headers.location).toContain('start=');
    });

    it('GET /tg/community should return shim for public channel (Android)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/community',
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('t.me/TalCareerBot');
    });

    it('GET /tg/vip-group should return shim for invite link (Android)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/vip-group',
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('t.me/+ABCdef123456');
    });

    it('should use defaultStartParam in redirect URL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot?utm_source=linkedin&utm_campaign=q1_promo',
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        },
      });

      expect(response.statusCode).toBe(200);

      // With defaultStartParam configured, the URL should contain hi_tal_count_me_in
      expect(response.body).toContain('start=Hytale_County');
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
    // Note: Most slugs now use defaultStartParam, so no attribution codes are generated
    // These tests verify the code resolution API still works for slugs without defaultStartParam

    it.skip('GET /r/:code should return attribution data', async () => {
      // Skipped: All bot slugs now use defaultStartParam instead of attribution codes
    });

    it('GET /r/:code should return 400 for nonexistent code', async () => {
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

    it.skip('GET /r/:code/status should return code status', async () => {
      // Skipped: All bot slugs now use defaultStartParam instead of attribution codes
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

    it('should handle dangerous query parameters safely', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tg/support-bot?onclick=alert(1)&constructor=bad',
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify the response HTML doesn't contain unescaped dangerous params
      expect(response.body).not.toContain('onclick=alert');
      // Should contain the safe defaultStartParam
      expect(response.body).toContain('start=Hytale_County');
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
