/**
 * Application configuration loaded from environment variables
 */

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config = {
  /** Server port */
  port: getEnvNumber('PORT', 3000),

  /** Server host */
  host: getEnvString('HOST', '0.0.0.0'),

  /** Environment */
  nodeEnv: getEnvString('NODE_ENV', 'development'),

  /** Base URL for the service */
  baseUrl: getEnvString('BASE_URL', 'http://localhost:3000'),

  /** Secret key for signing codes (must be at least 32 characters) */
  codeSigningSecret: getEnvString('CODE_SIGNING_SECRET', 'dev-secret-key-change-in-production-32'),

  /** SQLite database path */
  sqlitePath: getEnvString('SQLITE_PATH', './data/telegram-redirect.db'),

  /** Whether codes should be deleted after first resolution */
  oneTimeCodes: getEnvBoolean('ONE_TIME_CODES', false),

  /** Rate limit for resolve endpoint (requests per minute) */
  resolveRateLimit: getEnvNumber('RESOLVE_RATE_LIMIT', 60),

  /** Log level */
  logLevel: getEnvString('LOG_LEVEL', 'info'),

  /** Salt for IP hashing */
  ipHashSalt: getEnvString('IP_HASH_SALT', 'default-ip-salt'),

  /** Whether running in production */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },

  /** Whether running in development */
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },

  /** Validate required config for production */
  validate(): void {
    if (this.isProduction) {
      if (this.codeSigningSecret === 'dev-secret-key-change-in-production-32') {
        throw new Error('CODE_SIGNING_SECRET must be set in production');
      }
      if (this.codeSigningSecret.length < 32) {
        throw new Error('CODE_SIGNING_SECRET must be at least 32 characters');
      }
      if (this.ipHashSalt === 'default-ip-salt') {
        throw new Error('IP_HASH_SALT must be set in production');
      }
    }
  },
} as const;
