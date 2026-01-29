/**
 * Tests for user agent parsing
 */

import { describe, it, expect } from 'vitest';
import { parseUserAgent, isLinkedInUserAgent, isBot } from './ua.js';

describe('ua', () => {
  describe('parseUserAgent', () => {
    it('should detect iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('mobile');
      expect(result.os).toBe('iOS');
      expect(result.hasTelegramApp).toBe(true);
    });

    it('should detect Android mobile', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('mobile');
      expect(result.os).toBe('Android');
      expect(result.hasTelegramApp).toBe(true);
    });

    it('should detect iPad as tablet', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('tablet');
      expect(result.os).toBe('iOS');
      expect(result.hasTelegramApp).toBe(true);
    });

    it('should detect Android tablet', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 12; SM-T500) AppleWebKit/537.36 Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('tablet');
      expect(result.os).toBe('Android');
    });

    it('should detect desktop Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('desktop');
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Chrome');
    });

    it('should detect desktop macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
      const result = parseUserAgent(ua);

      expect(result.type).toBe('desktop');
      expect(result.os).toBe('macOS');
      expect(result.browser).toBe('Safari');
    });

    it('should detect Telegram in-app browser', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Telegram/10.0';
      const result = parseUserAgent(ua);

      expect(result.browser).toBe('Telegram');
      expect(result.hasTelegramApp).toBe(true);
    });

    it('should handle empty/undefined user agent', () => {
      expect(parseUserAgent('')).toEqual({
        type: 'unknown',
        os: 'Unknown',
        browser: 'Unknown',
        hasTelegramApp: false,
      });

      expect(parseUserAgent(undefined)).toEqual({
        type: 'unknown',
        os: 'Unknown',
        browser: 'Unknown',
        hasTelegramApp: false,
      });
    });

    it('should detect LinkedIn browser', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) LinkedIn/9.0';
      const result = parseUserAgent(ua);

      expect(result.browser).toBe('LinkedIn');
    });
  });

  describe('isLinkedInUserAgent', () => {
    it('should detect LinkedIn app', () => {
      expect(isLinkedInUserAgent('Mozilla/5.0 LinkedIn/9.0')).toBe(true);
      expect(isLinkedInUserAgent('LinkedInApp/1.0')).toBe(true);
    });

    it('should not match non-LinkedIn agents', () => {
      expect(isLinkedInUserAgent('Mozilla/5.0 Chrome/120')).toBe(false);
      expect(isLinkedInUserAgent('Safari/605.1.15')).toBe(false);
    });

    it('should handle empty/undefined', () => {
      expect(isLinkedInUserAgent('')).toBe(false);
      expect(isLinkedInUserAgent(undefined)).toBe(false);
    });
  });

  describe('isBot', () => {
    it('should detect common bots', () => {
      expect(isBot('Googlebot/2.1')).toBe(true);
      expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
      expect(isBot('facebookexternalhit/1.1')).toBe(true);
      expect(isBot('curl/7.68.0')).toBe(true);
      expect(isBot('wget/1.21')).toBe(true);
      expect(isBot('python-requests/2.28')).toBe(true);
    });

    it('should not match regular browsers', () => {
      expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')).toBe(false);
      expect(isBot('Mozilla/5.0 Chrome/120')).toBe(false);
    });

    it('should treat empty/undefined as bot', () => {
      expect(isBot('')).toBe(true);
      expect(isBot(undefined)).toBe(true);
    });
  });
});
