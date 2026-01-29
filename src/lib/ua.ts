/**
 * User-Agent parsing and device detection
 * Lightweight implementation without external dependencies
 */

import type { DeviceInfo } from '../types.js';

/** Mobile device patterns */
const MOBILE_PATTERNS = [
  /android.*mobile/i,
  /iphone/i,
  /ipod/i,
  /blackberry/i,
  /windows phone/i,
  /webos/i,
  /opera mini/i,
  /mobile safari/i,
];

/** Tablet patterns */
const TABLET_PATTERNS = [
  /ipad/i,
  /android(?!.*mobile)/i,
  /tablet/i,
  /kindle/i,
  /silk/i,
  /playbook/i,
];

/** OS detection patterns */
const OS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /iphone|ipad|ipod/i, name: 'iOS' },
  { pattern: /android/i, name: 'Android' },
  { pattern: /windows phone/i, name: 'Windows Phone' },
  { pattern: /windows/i, name: 'Windows' },
  { pattern: /mac os x|macos/i, name: 'macOS' },
  { pattern: /linux/i, name: 'Linux' },
  { pattern: /chrome os/i, name: 'Chrome OS' },
];

/** Browser detection patterns */
const BROWSER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /telegram/i, name: 'Telegram' },
  { pattern: /edg(e|a|ios)?/i, name: 'Edge' },
  { pattern: /chrome/i, name: 'Chrome' },
  { pattern: /safari/i, name: 'Safari' },
  { pattern: /firefox/i, name: 'Firefox' },
  { pattern: /opera|opr/i, name: 'Opera' },
  { pattern: /msie|trident/i, name: 'IE' },
  { pattern: /linkedin/i, name: 'LinkedIn' },
];

/**
 * Parse a user agent string to extract device information
 */
export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return {
      type: 'unknown',
      os: 'Unknown',
      browser: 'Unknown',
      hasTelegramApp: false,
    };
  }

  // Detect device type
  let type: DeviceInfo['type'] = 'desktop';
  if (MOBILE_PATTERNS.some((p) => p.test(userAgent))) {
    type = 'mobile';
  } else if (TABLET_PATTERNS.some((p) => p.test(userAgent))) {
    type = 'tablet';
  }

  // Detect OS
  let os = 'Unknown';
  for (const { pattern, name } of OS_PATTERNS) {
    if (pattern.test(userAgent)) {
      os = name;
      break;
    }
  }

  // Detect browser
  let browser = 'Unknown';
  for (const { pattern, name } of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      browser = name;
      break;
    }
  }

  // Determine if likely to have Telegram app installed
  // Mobile devices on iOS/Android are likely to have the app
  // Desktop OS users might have it but less common
  const hasTelegramApp =
    browser === 'Telegram' ||
    (type === 'mobile' && (os === 'iOS' || os === 'Android')) ||
    type === 'tablet';

  return {
    type,
    os,
    browser,
    hasTelegramApp,
  };
}

/**
 * Check if the user agent is from LinkedIn's crawler or in-app browser
 */
export function isLinkedInUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /linkedin/i.test(userAgent);
}

/**
 * Check if the user agent is likely a bot/crawler
 */
export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return true;
  return /bot|crawler|spider|scraper|curl|wget|python|java|php|facebook|externalhit|slurp|yahoo/i.test(userAgent);
}
