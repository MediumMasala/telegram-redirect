/**
 * Tests for shim HTML generation
 */

import { describe, it, expect } from 'vitest';
import { generateShimHtml, getDirectRedirectUrl } from './shim.js';

describe('shim', () => {
  describe('generateShimHtml', () => {
    it('should generate HTML with fallback URL for bot type', () => {
      const html = generateShimHtml({
        type: 'bot',
        destination: 'TestBot',
        startParam: 'abc123',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('https://t.me/TestBot?start=abc123');
      expect(html).toContain('tg://resolve?domain=TestBot');
      expect(html).toContain('start=abc123');
      expect(html).toContain('Open in Telegram App');
    });

    it('should generate HTML for public channel', () => {
      const html = generateShimHtml({
        type: 'public',
        destination: 'channelname',
      });

      expect(html).toContain('https://t.me/channelname');
      expect(html).toContain('tg://resolve?domain=channelname');
    });

    it('should generate HTML for invite link', () => {
      const html = generateShimHtml({
        type: 'invite',
        destination: 'abcDEF123',
      });

      expect(html).toContain('https://t.me/+abcDEF123');
      expect(html).toContain('tg://join?invite=abcDEF123');
    });

    it('should include custom title and description', () => {
      const html = generateShimHtml({
        type: 'public',
        destination: 'test',
        title: 'Join Our Community',
        description: 'Welcome to the community!',
      });

      expect(html).toContain('Join Our Community');
      expect(html).toContain('Welcome to the community!');
    });

    it('should escape HTML in title and description', () => {
      const html = generateShimHtml({
        type: 'public',
        destination: 'test',
        title: '<script>alert("xss")</script>',
        description: 'Test & "quotes"',
      });

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
    });

    it('should include OG meta tags', () => {
      const html = generateShimHtml({
        type: 'public',
        destination: 'test',
        title: 'Test Title',
      });

      expect(html).toContain('og:title');
      expect(html).toContain('og:description');
      expect(html).toContain('twitter:card');
    });

    it('should include fallback delay in script', () => {
      const html = generateShimHtml({
        type: 'public',
        destination: 'test',
        fallbackDelay: 1500,
      });

      expect(html).toContain('fallbackDelay = 1500');
    });

    it('should include fallback instructions', () => {
      const html = generateShimHtml({
        type: 'bot',
        destination: 'TestBot',
      });

      expect(html).toContain('Having trouble?');
      expect(html).toContain('Open in browser');
      expect(html).toContain('fallbackInstructions');
    });

    it('should include ref tag when startParam is provided', () => {
      const html = generateShimHtml({
        type: 'bot',
        destination: 'TestBot',
        startParam: 'abc123456789xyz',
      });

      expect(html).toContain('ref: abc123456789');
    });
  });

  describe('getDirectRedirectUrl', () => {
    it('should generate correct URL for bot with start param', () => {
      const url = getDirectRedirectUrl('bot', 'TestBot', 'code123');
      expect(url).toBe('https://t.me/TestBot?start=code123');
    });

    it('should generate correct URL for bot without start param', () => {
      const url = getDirectRedirectUrl('bot', 'TestBot');
      expect(url).toBe('https://t.me/TestBot');
    });

    it('should generate correct URL for public channel', () => {
      const url = getDirectRedirectUrl('public', 'channelname');
      expect(url).toBe('https://t.me/channelname');
    });

    it('should generate correct URL for invite', () => {
      const url = getDirectRedirectUrl('invite', 'abcDEF');
      expect(url).toBe('https://t.me/+abcDEF');
    });

    it('should encode special characters', () => {
      const url = getDirectRedirectUrl('bot', 'TestBot', 'a b+c');
      expect(url).toContain('a%20b%2Bc');
    });
  });
});
