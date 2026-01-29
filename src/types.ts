/**
 * Core type definitions for the Telegram Redirect & Attribution service
 */

/** Telegram destination types */
export type TelegramDestinationType = 'bot' | 'public' | 'invite';

/** Redirect mode */
export type RedirectMode = '302' | 'shim';

/** Slug configuration for a redirect endpoint */
export interface SlugConfig {
  /** Unique slug identifier (URL path segment) */
  slug: string;
  /** Type of Telegram destination */
  type: TelegramDestinationType;
  /** Redirect mode: 302 for direct redirect, shim for HTML intermediate page */
  mode: RedirectMode;
  /**
   * Destination identifier:
   * - For 'bot': bot username (without @)
   * - For 'public': channel/user username (without @)
   * - For 'invite': invite hash (without +)
   */
  destination: string;
  /** Optional description for documentation */
  description?: string;
  /** Whether this slug is active */
  active: boolean;
  /**
   * Default start parameter for bot type (pre-filled message).
   * If set, this will be used instead of attribution code.
   * Max 64 characters for Telegram.
   */
  defaultStartParam?: string;
}

/** Complete slugs configuration file structure */
export interface SlugsConfig {
  slugs: SlugConfig[];
}

/** UTM parameters extracted from query string */
export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/** Click attribution data stored with a code */
export interface ClickAttribution {
  /** The slug that was accessed */
  slug: string;
  /** Timestamp of the click (ISO 8601) */
  timestamp: string;
  /** UTM parameters */
  utm: UTMParams;
  /** Additional query parameters (non-UTM) */
  extraParams: Record<string, string>;
  /** Hashed IP address for privacy */
  ipHash: string;
  /** User agent string */
  userAgent: string;
  /** Parsed user agent info */
  device: DeviceInfo;
  /** Unique request ID */
  requestId: string;
}

/** Stored code mapping record */
export interface CodeMapping {
  /** The generated short code */
  code: string;
  /** Attribution data */
  attribution: ClickAttribution;
  /** Bot username this code is for */
  botUsername: string;
  /** Creation timestamp */
  createdAt: string;
  /** Whether this code has been resolved */
  resolved: boolean;
  /** Resolution timestamp if resolved */
  resolvedAt?: string;
}

/** Click log record */
export interface ClickLog {
  /** Unique request ID */
  requestId: string;
  /** Slug accessed */
  slug: string;
  /** Timestamp */
  timestamp: string;
  /** Hashed IP */
  ipHash: string;
  /** User agent */
  userAgent: string;
  /** Final redirect target URL */
  redirectTarget: string;
  /** Generated code (for bot type) */
  code?: string;
  /** All query parameters received */
  queryParams: Record<string, string>;
}

/** Device info from user agent parsing */
export interface DeviceInfo {
  /** Device type: mobile, tablet, desktop */
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  /** Operating system */
  os: string;
  /** Browser name */
  browser: string;
  /** Whether likely to support Telegram app */
  hasTelegramApp: boolean;
}

/** Code resolution response */
export interface ResolveResponse {
  success: boolean;
  data?: ClickAttribution;
  error?: string;
}

/** Health check response */
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
}

/** Storage interface for database abstraction */
export interface IStorage {
  /** Initialize storage (create tables, etc.) */
  init(): Promise<void>;

  /** Store a code mapping */
  storeCode(mapping: CodeMapping): Promise<void>;

  /** Retrieve a code mapping */
  getCode(code: string): Promise<CodeMapping | null>;

  /** Mark a code as resolved */
  markResolved(code: string): Promise<void>;

  /** Delete a code (for one-time use) */
  deleteCode(code: string): Promise<void>;

  /** Log a click */
  logClick(log: ClickLog): Promise<void>;

  /** Get click logs for a slug (for analytics) */
  getClickLogs(slug: string, limit?: number): Promise<ClickLog[]>;

  /** Close connection */
  close(): Promise<void>;
}

/** LRU Cache interface */
export interface ICache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}
