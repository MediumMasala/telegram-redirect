/**
 * In-memory LRU cache for hot code resolves
 */

import { LRUCache } from 'lru-cache';
import type { CodeMapping, ICache } from '../types.js';

/** Default cache options */
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create an LRU cache for code mappings
 */
export function createCodeCache(
  maxSize: number = DEFAULT_MAX_SIZE,
  ttlMs: number = DEFAULT_TTL_MS
): ICache<CodeMapping> {
  const cache = new LRUCache<string, CodeMapping>({
    max: maxSize,
    ttl: ttlMs,
  });

  return {
    get(key: string): CodeMapping | undefined {
      return cache.get(key);
    },
    set(key: string, value: CodeMapping): void {
      cache.set(key, value);
    },
    delete(key: string): void {
      cache.delete(key);
    },
    clear(): void {
      cache.clear();
    },
  };
}

/**
 * Create a simple in-memory cache (no LRU eviction)
 * Useful for slug configs that rarely change
 */
export function createSimpleCache<T>(): ICache<T> {
  const cache = new Map<string, T>();

  return {
    get(key: string): T | undefined {
      return cache.get(key);
    },
    set(key: string, value: T): void {
      cache.set(key, value);
    },
    delete(key: string): void {
      cache.delete(key);
    },
    clear(): void {
      cache.clear();
    },
  };
}
