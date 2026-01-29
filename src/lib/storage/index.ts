/**
 * Storage module exports
 */

export type { IStorage, CodeMapping, ClickLog, StorageFactory } from './interface.js';
export { SQLiteStorage, createSQLiteStorage } from './sqlite.js';
export { MemoryStorage, createMemoryStorage } from './memory.js';
