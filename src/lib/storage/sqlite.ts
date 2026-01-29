/**
 * SQLite storage implementation using better-sqlite3
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IStorage, CodeMapping, ClickLog } from '../../types.js';
import { config } from '../../config.js';

/**
 * SQLite implementation of the storage interface
 */
export class SQLiteStorage implements IStorage {
  private db: Database.Database;
  private storeCodeStmt!: Database.Statement;
  private getCodeStmt!: Database.Statement;
  private markResolvedStmt!: Database.Statement;
  private deleteCodeStmt!: Database.Statement;
  private logClickStmt!: Database.Statement;
  private getClickLogsStmt!: Database.Statement;

  constructor(dbPath: string = config.sqlitePath) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    // Create tables
    this.db.exec(`
      -- Code mappings table
      CREATE TABLE IF NOT EXISTS code_mappings (
        code TEXT PRIMARY KEY,
        bot_username TEXT NOT NULL,
        attribution TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolved_at TEXT
      );

      -- Click logs table
      CREATE TABLE IF NOT EXISTS click_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        redirect_target TEXT NOT NULL,
        code TEXT,
        query_params TEXT NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_click_logs_slug ON click_logs(slug);
      CREATE INDEX IF NOT EXISTS idx_click_logs_timestamp ON click_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_code_mappings_created ON code_mappings(created_at);
    `);

    // Prepare statements for better performance
    this.storeCodeStmt = this.db.prepare(`
      INSERT INTO code_mappings (code, bot_username, attribution, created_at, resolved)
      VALUES (?, ?, ?, ?, 0)
    `);

    this.getCodeStmt = this.db.prepare(`
      SELECT code, bot_username, attribution, created_at, resolved, resolved_at
      FROM code_mappings
      WHERE code = ?
    `);

    this.markResolvedStmt = this.db.prepare(`
      UPDATE code_mappings
      SET resolved = 1, resolved_at = ?
      WHERE code = ?
    `);

    this.deleteCodeStmt = this.db.prepare(`
      DELETE FROM code_mappings WHERE code = ?
    `);

    this.logClickStmt = this.db.prepare(`
      INSERT INTO click_logs (request_id, slug, timestamp, ip_hash, user_agent, redirect_target, code, query_params)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getClickLogsStmt = this.db.prepare(`
      SELECT request_id, slug, timestamp, ip_hash, user_agent, redirect_target, code, query_params
      FROM click_logs
      WHERE slug = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
  }

  async storeCode(mapping: CodeMapping): Promise<void> {
    this.storeCodeStmt.run(
      mapping.code,
      mapping.botUsername,
      JSON.stringify(mapping.attribution),
      mapping.createdAt
    );
  }

  async getCode(code: string): Promise<CodeMapping | null> {
    const row = this.getCodeStmt.get(code) as {
      code: string;
      bot_username: string;
      attribution: string;
      created_at: string;
      resolved: number;
      resolved_at: string | null;
    } | undefined;

    if (!row) return null;

    return {
      code: row.code,
      botUsername: row.bot_username,
      attribution: JSON.parse(row.attribution),
      createdAt: row.created_at,
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at ?? undefined,
    };
  }

  async markResolved(code: string): Promise<void> {
    this.markResolvedStmt.run(new Date().toISOString(), code);
  }

  async deleteCode(code: string): Promise<void> {
    this.deleteCodeStmt.run(code);
  }

  async logClick(log: ClickLog): Promise<void> {
    this.logClickStmt.run(
      log.requestId,
      log.slug,
      log.timestamp,
      log.ipHash,
      log.userAgent,
      log.redirectTarget,
      log.code ?? null,
      JSON.stringify(log.queryParams)
    );
  }

  async getClickLogs(slug: string, limit: number = 100): Promise<ClickLog[]> {
    const rows = this.getClickLogsStmt.all(slug, limit) as Array<{
      request_id: string;
      slug: string;
      timestamp: string;
      ip_hash: string;
      user_agent: string;
      redirect_target: string;
      code: string | null;
      query_params: string;
    }>;

    return rows.map((row) => ({
      requestId: row.request_id,
      slug: row.slug,
      timestamp: row.timestamp,
      ipHash: row.ip_hash,
      userAgent: row.user_agent,
      redirectTarget: row.redirect_target,
      code: row.code ?? undefined,
      queryParams: JSON.parse(row.query_params),
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Create and initialize SQLite storage
 */
export async function createSQLiteStorage(dbPath?: string): Promise<IStorage> {
  const storage = new SQLiteStorage(dbPath);
  await storage.init();
  return storage;
}
