/**
 * Storage interface definition
 * Allows swapping implementations (SQLite, Postgres, etc.)
 */

import type { IStorage, CodeMapping, ClickLog } from '../../types.js';

export type { IStorage, CodeMapping, ClickLog };

/**
 * Storage factory function type
 */
export type StorageFactory = () => Promise<IStorage>;
