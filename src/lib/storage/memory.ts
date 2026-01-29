/**
 * In-memory storage implementation
 *
 * WARNING: This storage is ephemeral and will lose data when the serverless
 * function cold starts. Use only for development/testing or when you don't
 * need persistent attribution data.
 *
 * For production on Vercel, use:
 * - Vercel KV (Redis)
 * - Vercel Postgres
 * - External database (PlanetScale, Supabase, etc.)
 */

import type { IStorage, CodeMapping, ClickLog } from '../../types.js';

/** In-memory storage maps */
const codeMappings = new Map<string, CodeMapping>();
const clickLogs: ClickLog[] = [];

/** Maximum click logs to keep in memory */
const MAX_CLICK_LOGS = 10000;

/**
 * In-memory implementation of the storage interface
 */
export class MemoryStorage implements IStorage {
  async init(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  async storeCode(mapping: CodeMapping): Promise<void> {
    codeMappings.set(mapping.code, { ...mapping });
  }

  async getCode(code: string): Promise<CodeMapping | null> {
    const mapping = codeMappings.get(code);
    return mapping ? { ...mapping } : null;
  }

  async markResolved(code: string): Promise<void> {
    const mapping = codeMappings.get(code);
    if (mapping) {
      mapping.resolved = true;
      mapping.resolvedAt = new Date().toISOString();
    }
  }

  async deleteCode(code: string): Promise<void> {
    codeMappings.delete(code);
  }

  async logClick(log: ClickLog): Promise<void> {
    clickLogs.push({ ...log });
    // Keep memory bounded
    if (clickLogs.length > MAX_CLICK_LOGS) {
      clickLogs.shift();
    }
  }

  async getClickLogs(slug: string, limit: number = 100): Promise<ClickLog[]> {
    return clickLogs
      .filter((log) => log.slug === slug)
      .slice(-limit)
      .reverse();
  }

  async close(): Promise<void> {
    // No cleanup needed
  }

  /** Get storage stats (for debugging) */
  getStats(): { codes: number; clicks: number } {
    return {
      codes: codeMappings.size,
      clicks: clickLogs.length,
    };
  }

  /** Clear all data (for testing) */
  clear(): void {
    codeMappings.clear();
    clickLogs.length = 0;
  }
}

/**
 * Create in-memory storage instance
 */
export async function createMemoryStorage(): Promise<IStorage> {
  const storage = new MemoryStorage();
  await storage.init();
  return storage;
}
