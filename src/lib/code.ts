/**
 * Code generation and validation for Telegram bot start parameters
 *
 * Requirements:
 * - Codes must be URL-safe: [A-Za-z0-9_-]
 * - Maximum 64 characters (Telegram limit for start parameter)
 * - Signed to prevent tampering
 * - Unique and collision-resistant
 */

import { createHmac, randomBytes } from 'node:crypto';
import { config } from '../config.js';

/** Maximum code length per Telegram requirements */
const MAX_CODE_LENGTH = 64;

/** Random bytes for code generation (produces ~21-22 base64url chars) */
const RANDOM_BYTES = 16;

/** Signature length in characters */
const SIGNATURE_LENGTH = 8;

/**
 * Convert bytes to base64url string
 */
function bytesToBase64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

/**
 * Generate a cryptographically random code component
 */
function generateRandomPart(): string {
  const bytes = randomBytes(RANDOM_BYTES);
  return bytesToBase64url(bytes);
}

/**
 * Create a truncated HMAC signature for a payload
 */
function createSignature(payload: string): string {
  const hmac = createHmac('sha256', config.codeSigningSecret);
  hmac.update(payload);
  const fullSig = hmac.digest('base64url');
  // Truncate to save space while maintaining security
  return fullSig.slice(0, SIGNATURE_LENGTH);
}

/**
 * Verify the signature of a code
 */
function verifySignature(payload: string, signature: string): boolean {
  const expectedSig = createSignature(payload);
  // Constant-time comparison to prevent timing attacks
  if (expectedSig.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    result |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a short, signed code for use as Telegram bot start parameter
 *
 * Format: {random}{signature}
 * - random: 16 bytes base64url encoded (~22 chars)
 * - signature: truncated HMAC (~8 chars)
 * Total: ~30 chars (well under 64 limit)
 *
 * @returns A URL-safe code string
 */
export function generateCode(): string {
  const random = generateRandomPart();
  const signature = createSignature(random);
  const code = `${random}${signature}`;

  // Sanity check - should never exceed 64 chars with current config
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`Generated code exceeds maximum length: ${code.length}`);
  }

  return code;
}

/**
 * Validate that a code is well-formed and has a valid signature
 *
 * @param code The code to validate
 * @returns true if code is valid, false otherwise
 */
export function validateCode(code: string): boolean {
  // Check length
  if (!code || code.length < SIGNATURE_LENGTH + 10 || code.length > MAX_CODE_LENGTH) {
    return false;
  }

  // Check characters (must be URL-safe base64)
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return false;
  }

  // Extract and verify signature
  const payload = code.slice(0, -SIGNATURE_LENGTH);
  const signature = code.slice(-SIGNATURE_LENGTH);

  return verifySignature(payload, signature);
}

/**
 * Check if a string is a valid code format (without signature verification)
 * Useful for quick input validation before database lookup
 */
export function isValidCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  if (code.length > MAX_CODE_LENGTH) return false;
  return /^[A-Za-z0-9_-]+$/.test(code);
}

/**
 * Sanitize a string to be safe for use in URLs
 * Strips any characters not in the allowed set
 */
export function sanitizeForUrl(input: string, maxLength: number = MAX_CODE_LENGTH): string {
  return input
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, maxLength);
}
