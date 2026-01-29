/**
 * Tests for code generation and validation
 */

import { describe, it, expect } from 'vitest';
import { generateCode, validateCode, isValidCodeFormat, sanitizeForUrl } from './code.js';

describe('code', () => {
  describe('generateCode', () => {
    it('should generate a code within length limit', () => {
      const code = generateCode();
      expect(code.length).toBeLessThanOrEqual(64);
      expect(code.length).toBeGreaterThan(20); // Should have reasonable entropy
    });

    it('should generate URL-safe codes', () => {
      const code = generateCode();
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        codes.add(generateCode());
      }
      expect(codes.size).toBe(1000);
    });
  });

  describe('validateCode', () => {
    it('should validate a generated code', () => {
      const code = generateCode();
      expect(validateCode(code)).toBe(true);
    });

    it('should reject empty code', () => {
      expect(validateCode('')).toBe(false);
    });

    it('should reject code that is too short', () => {
      expect(validateCode('abc')).toBe(false);
    });

    it('should reject code that is too long', () => {
      const longCode = 'a'.repeat(65);
      expect(validateCode(longCode)).toBe(false);
    });

    it('should reject code with invalid characters', () => {
      expect(validateCode('abc!@#$%')).toBe(false);
    });

    it('should reject tampered code', () => {
      const code = generateCode();
      // Modify a character in the middle
      const tampered = code.slice(0, 10) + 'X' + code.slice(11);
      expect(validateCode(tampered)).toBe(false);
    });
  });

  describe('isValidCodeFormat', () => {
    it('should accept valid format', () => {
      expect(isValidCodeFormat('abc123_-XYZ')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isValidCodeFormat('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidCodeFormat(null as unknown as string)).toBe(false);
      expect(isValidCodeFormat(undefined as unknown as string)).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidCodeFormat('abc!@#')).toBe(false);
      expect(isValidCodeFormat('abc def')).toBe(false);
      expect(isValidCodeFormat('abc+def')).toBe(false);
    });

    it('should reject too long codes', () => {
      expect(isValidCodeFormat('a'.repeat(65))).toBe(false);
    });
  });

  describe('sanitizeForUrl', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeForUrl('abc!@#def')).toBe('abcdef');
    });

    it('should preserve valid characters', () => {
      expect(sanitizeForUrl('abc123_-XYZ')).toBe('abc123_-XYZ');
    });

    it('should truncate to max length', () => {
      const result = sanitizeForUrl('a'.repeat(100), 50);
      expect(result.length).toBe(50);
    });
  });
});
