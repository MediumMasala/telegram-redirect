/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateRequestId,
  hashIp,
  extractUtmParams,
  extractExtraParams,
  sanitizeParamValue,
  sanitizeParamKey,
  isDangerousParam,
  getClientIp,
} from './utils.js';

describe('utils', () => {
  describe('generateRequestId', () => {
    it('should generate a UUID', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('hashIp', () => {
    it('should return consistent hash for same IP', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.1');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different IPs', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle undefined', () => {
      expect(hashIp(undefined)).toBe('unknown');
    });

    it('should strip port from IP', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.1:8080');
      expect(hash1).toBe(hash2);
    });

    it('should return truncated hash', () => {
      const hash = hashIp('192.168.1.1');
      expect(hash.length).toBe(16);
    });
  });

  describe('getClientIp', () => {
    it('should extract from x-forwarded-for', () => {
      const ip = getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract from x-real-ip', () => {
      const ip = getClientIp({ 'x-real-ip': '1.2.3.4' });
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract from cf-connecting-ip', () => {
      const ip = getClientIp({ 'cf-connecting-ip': '1.2.3.4' });
      expect(ip).toBe('1.2.3.4');
    });

    it('should prefer x-forwarded-for', () => {
      const ip = getClientIp({
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      });
      expect(ip).toBe('1.1.1.1');
    });

    it('should return unknown for empty headers', () => {
      expect(getClientIp({})).toBe('unknown');
    });
  });

  describe('extractUtmParams', () => {
    it('should extract all UTM parameters', () => {
      const query = {
        utm_source: 'linkedin',
        utm_medium: 'cpc',
        utm_campaign: 'q1-promo',
        utm_term: 'telegram bot',
        utm_content: 'banner-a',
        other_param: 'ignored',
      };

      const utm = extractUtmParams(query);

      expect(utm.utm_source).toBe('linkedin');
      expect(utm.utm_medium).toBe('cpc');
      expect(utm.utm_campaign).toBe('q1-promo');
      expect(utm.utm_term).toBe('telegram bot');
      expect(utm.utm_content).toBe('banner-a');
      expect((utm as Record<string, unknown>)['other_param']).toBeUndefined();
    });

    it('should handle missing parameters', () => {
      const utm = extractUtmParams({ utm_source: 'test' });

      expect(utm.utm_source).toBe('test');
      expect(utm.utm_medium).toBeUndefined();
    });

    it('should sanitize values', () => {
      const utm = extractUtmParams({
        utm_source: '<script>alert(1)</script>',
      });

      expect(utm.utm_source).toBe('scriptalert(1)/script');
    });
  });

  describe('extractExtraParams', () => {
    it('should extract non-UTM parameters', () => {
      const query = {
        utm_source: 'linkedin',
        custom_param: 'value',
        another: 'test',
      };

      const extra = extractExtraParams(query);

      expect(extra.custom_param).toBe('value');
      expect(extra.another).toBe('test');
      expect(extra.utm_source).toBeUndefined();
    });

    it('should skip dangerous parameters', () => {
      const query = {
        onclick: 'alert(1)',
        safe_param: 'ok',
      };

      const extra = extractExtraParams(query);

      expect(extra.onclick).toBeUndefined();
      expect(extra.safe_param).toBe('ok');
    });

    it('should skip prototype pollution attempts', () => {
      const query: Record<string, string> = {};
      // Use Object.defineProperty to set __proto__ as own property
      Object.defineProperty(query, '__proto__', {
        value: 'bad',
        enumerable: true,
        configurable: true,
        writable: true,
      });
      query.constructor = 'bad';
      query.safe_param = 'ok';

      const extra = extractExtraParams(query);

      expect(Object.keys(extra)).not.toContain('__proto__');
      expect(Object.keys(extra)).not.toContain('constructor');
      expect(extra.safe_param).toBe('ok');
    });
  });

  describe('sanitizeParamValue', () => {
    it('should truncate long values', () => {
      const longValue = 'a'.repeat(500);
      const result = sanitizeParamValue(longValue);
      expect(result.length).toBe(256);
    });

    it('should remove XSS characters', () => {
      expect(sanitizeParamValue('<script>')).toBe('script');
      expect(sanitizeParamValue('test"onclick')).toBe('testonclick');
      expect(sanitizeParamValue("it's")).toBe('its');
    });
  });

  describe('sanitizeParamKey', () => {
    it('should truncate long keys', () => {
      const longKey = 'a'.repeat(100);
      const result = sanitizeParamKey(longKey);
      expect(result.length).toBe(64);
    });

    it('should remove special characters', () => {
      expect(sanitizeParamKey('param[0]')).toBe('param0');
      expect(sanitizeParamKey('my-param_123')).toBe('my-param_123');
    });
  });

  describe('isDangerousParam', () => {
    it('should detect javascript: prefix', () => {
      expect(isDangerousParam('javascript:alert')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(isDangerousParam('onclick')).toBe(true);
      expect(isDangerousParam('onerror')).toBe(true);
      expect(isDangerousParam('onload')).toBe(true);
    });

    it('should detect prototype pollution', () => {
      expect(isDangerousParam('__proto__')).toBe(true);
      expect(isDangerousParam('constructor')).toBe(true);
      expect(isDangerousParam('prototype')).toBe(true);
    });

    it('should allow safe params', () => {
      expect(isDangerousParam('utm_source')).toBe(false);
      expect(isDangerousParam('campaign_id')).toBe(false);
    });
  });
});
