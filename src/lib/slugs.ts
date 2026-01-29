/**
 * Slug configuration loader and validator
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SlugConfig, SlugsConfig } from '../types.js';
import { createSimpleCache } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find the slugs config file
 * Searches in multiple locations to handle both dev and production
 */
function findSlugsConfigPath(): string {
  const candidates = [
    // Environment variable override
    process.env.SLUGS_CONFIG_PATH,
    // Relative to current working directory
    resolve(process.cwd(), 'src/config/slugs.json'),
    resolve(process.cwd(), 'config/slugs.json'),
    resolve(process.cwd(), 'slugs.json'),
    // Relative to this file (works in dev with tsx)
    resolve(__dirname, '../config/slugs.json'),
    // Relative to dist (for compiled output)
    resolve(__dirname, '../../src/config/slugs.json'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Default path for error message
  return resolve(process.cwd(), 'src/config/slugs.json');
}

/** Default path to slugs config */
const DEFAULT_SLUGS_PATH = findSlugsConfigPath();

/** In-memory cache for slug configs */
const slugCache = createSimpleCache<SlugConfig>();

/** All loaded slugs */
let allSlugs: SlugConfig[] = [];

/**
 * Validate a single slug config
 */
function validateSlugConfig(slug: unknown, index: number): SlugConfig {
  if (!slug || typeof slug !== 'object') {
    throw new Error(`Invalid slug config at index ${index}: not an object`);
  }

  const s = slug as Record<string, unknown>;

  // Required fields
  if (typeof s.slug !== 'string' || s.slug.length === 0) {
    throw new Error(`Invalid slug config at index ${index}: missing or invalid 'slug'`);
  }

  if (!['bot', 'public', 'invite'].includes(s.type as string)) {
    throw new Error(`Invalid slug config at index ${index}: 'type' must be 'bot', 'public', or 'invite'`);
  }

  if (!['302', 'shim'].includes(s.mode as string)) {
    throw new Error(`Invalid slug config at index ${index}: 'mode' must be '302' or 'shim'`);
  }

  if (typeof s.destination !== 'string' || s.destination.length === 0) {
    throw new Error(`Invalid slug config at index ${index}: missing or invalid 'destination'`);
  }

  // Validate slug format (URL-safe)
  if (!/^[a-zA-Z0-9_-]+$/.test(s.slug)) {
    throw new Error(`Invalid slug config at index ${index}: slug must contain only [a-zA-Z0-9_-]`);
  }

  // Validate destination based on type
  if (s.type === 'invite') {
    // Invite hashes should be alphanumeric
    if (!/^[a-zA-Z0-9_-]+$/.test(s.destination)) {
      throw new Error(`Invalid slug config at index ${index}: invite hash contains invalid characters`);
    }
  } else {
    // Usernames should be alphanumeric with underscores
    if (!/^[a-zA-Z0-9_]+$/.test(s.destination)) {
      throw new Error(`Invalid slug config at index ${index}: username contains invalid characters`);
    }
  }

  return {
    slug: s.slug,
    type: s.type as SlugConfig['type'],
    mode: s.mode as SlugConfig['mode'],
    destination: s.destination,
    description: typeof s.description === 'string' ? s.description : undefined,
    defaultStartParam: typeof s.defaultStartParam === 'string' ? s.defaultStartParam : undefined,
    active: s.active !== false, // Default to true if not specified
  };
}

/**
 * Load and validate slugs configuration from a JSON file
 */
export function loadSlugsConfig(configPath: string = DEFAULT_SLUGS_PATH): SlugsConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Slugs config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in slugs config: ${configPath}`);
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { slugs?: unknown }).slugs)) {
    throw new Error('Slugs config must have a "slugs" array');
  }

  const config = parsed as { slugs: unknown[] };
  const slugs = config.slugs.map((s, i) => validateSlugConfig(s, i));

  // Check for duplicate slugs
  const seenSlugs = new Set<string>();
  for (const slug of slugs) {
    if (seenSlugs.has(slug.slug)) {
      throw new Error(`Duplicate slug found: ${slug.slug}`);
    }
    seenSlugs.add(slug.slug);
  }

  // Update cache and allSlugs
  slugCache.clear();
  for (const slug of slugs) {
    slugCache.set(slug.slug, slug);
  }
  allSlugs = slugs;

  return { slugs };
}

/**
 * Get a slug configuration by slug name
 * Returns null if not found or inactive
 */
export function getSlugConfig(slug: string): SlugConfig | null {
  const config = slugCache.get(slug);
  if (!config || !config.active) return null;
  return config;
}

/**
 * Get all active slugs
 */
export function getAllActiveSlugs(): SlugConfig[] {
  return allSlugs.filter((s) => s.active);
}

/**
 * Check if a slug exists and is active
 */
export function isValidSlug(slug: string): boolean {
  return getSlugConfig(slug) !== null;
}

/**
 * Reload slugs configuration
 * Useful for hot-reloading config changes
 */
export function reloadSlugsConfig(configPath?: string): void {
  loadSlugsConfig(configPath);
}
