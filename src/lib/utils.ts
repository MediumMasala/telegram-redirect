/**
 * Utility functions for the redirect service
 */

import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { UTMParams } from '../types.js';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Hash an IP address for privacy
 * Uses SHA-256 with a salt to prevent reverse lookups
 */
export function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // Normalize IP (remove port if present)
  const normalizedIp = ip.split(':')[0] || ip;

  const hash = createHash('sha256');
  hash.update(config.ipHashSalt + normalizedIp);
  return hash.digest('hex').slice(0, 16); // Truncate for storage efficiency
}

/**
 * Extract client IP from request headers
 * Handles common proxy headers
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  // Check common proxy headers
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // Take the first (original client) IP
    return ips.split(',')[0].trim();
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  const cfConnectingIp = headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  return 'unknown';
}

/** Known UTM parameter names */
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/**
 * Extract UTM parameters from a query object
 */
export function extractUtmParams(query: Record<string, unknown>): UTMParams {
  const utm: UTMParams = {};

  for (const key of UTM_PARAMS) {
    const value = query[key];
    if (typeof value === 'string' && value.length > 0) {
      // Sanitize value - limit length and strip potentially dangerous characters
      utm[key] = sanitizeParamValue(value);
    }
  }

  return utm;
}

/**
 * Extract non-UTM query parameters
 */
export function extractExtraParams(query: Record<string, unknown>): Record<string, string> {
  const extra: Record<string, string> = {};
  const utmSet = new Set(UTM_PARAMS as readonly string[]);

  for (const [key, value] of Object.entries(query)) {
    if (!utmSet.has(key) && typeof value === 'string' && value.length > 0) {
      // Skip potentially dangerous params
      if (isDangerousParam(key)) continue;
      extra[sanitizeParamKey(key)] = sanitizeParamValue(value);
    }
  }

  return extra;
}

/** Maximum length for parameter values */
const MAX_PARAM_VALUE_LENGTH = 256;
const MAX_PARAM_KEY_LENGTH = 64;

/**
 * Sanitize a parameter value
 */
export function sanitizeParamValue(value: string): string {
  return value
    .slice(0, MAX_PARAM_VALUE_LENGTH)
    .replace(/[<>"']/g, ''); // Remove characters that could be used for XSS
}

/**
 * Sanitize a parameter key
 */
export function sanitizeParamKey(key: string): string {
  return key
    .slice(0, MAX_PARAM_KEY_LENGTH)
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Dangerous parameter patterns to skip */
const DANGEROUS_PARAMS = [
  /^javascript:/i,
  /^data:/i,
  /^vbscript:/i,
  /on\w+$/i, // onclick, onerror, etc.
  /^__proto__$/i,
  /^constructor$/i,
  /^prototype$/i,
];

/**
 * Check if a parameter key is potentially dangerous
 */
export function isDangerousParam(key: string): boolean {
  return DANGEROUS_PARAMS.some((pattern) => pattern.test(key));
}

/**
 * Parse a comma-separated list from env variable
 */
export function parseEnvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Sleep for a specified number of milliseconds
 * Useful for testing and rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
