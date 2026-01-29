# Telegram Redirect & Attribution Service

A production-ready service for handling LinkedIn ad clicks and redirecting users to Telegram with full attribution tracking. Similar to WhatsApp redirect systems, but optimized for Telegram's deep linking requirements.

## Features

- **LinkedIn-compatible redirects**: HTTPS URLs that work as LinkedIn ad destinations
- **Multiple destination types**: Bots, public channels/users, and invite links
- **Shim page support**: HTML page that attempts `tg://` deep link before falling back to `https://t.me/`
- **Attribution tracking**: Preserves UTM parameters and other query params for analytics
- **Bot integration**: Short codes for bot `/start` payloads with server-side attribution storage
- **Security**: Signed codes, no open redirects, rate limiting, IP hashing for privacy
- **Deployment-agnostic**: Works on Vercel, Docker, or any Node.js server

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `NODE_ENV` | Environment (`development`/`production`) | `development` |
| `BASE_URL` | Public URL of the service | `http://localhost:3000` |
| `CODE_SIGNING_SECRET` | Secret for signing codes (min 32 chars) | Required in production |
| `SQLITE_PATH` | Path to SQLite database | `./data/telegram-redirect.db` |
| `ONE_TIME_CODES` | Delete codes after first resolution | `false` |
| `RESOLVE_RATE_LIMIT` | Max requests/minute for `/r/:code` | `60` |
| `IP_HASH_SALT` | Salt for IP hashing | Required in production |
| `LOG_LEVEL` | Logging level | `info` |

### Creating a New Slug

Edit `src/config/slugs.json`:

```json
{
  "slugs": [
    {
      "slug": "my-campaign",
      "type": "bot",
      "mode": "shim",
      "destination": "MyTelegramBot",
      "description": "Q1 2024 LinkedIn campaign",
      "active": true
    }
  ]
}
```

**Fields:**

| Field | Description |
|-------|-------------|
| `slug` | URL path segment (e.g., `/tg/my-campaign`) |
| `type` | `bot`, `public`, or `invite` |
| `mode` | `302` (direct redirect) or `shim` (HTML page) |
| `destination` | Bot username, channel username, or invite hash |
| `description` | Optional description |
| `active` | Enable/disable without removing |

**Type examples:**

- `bot` + `MyBot` → `https://t.me/MyBot?start=<code>`
- `public` + `MyChannel` → `https://t.me/MyChannel`
- `invite` + `ABC123` → `https://t.me/+ABC123`

## API Endpoints

### GET /tg/:slug

Main redirect endpoint. Use this URL in LinkedIn ads.

**Example:**
```
https://your-domain.com/tg/my-campaign?utm_source=linkedin&utm_campaign=q1
```

**Query Parameters:**
- All UTM parameters are preserved (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`)
- Additional parameters are stored in `extraParams`

**Response:**
- `mode=302`: HTTP 302 redirect to Telegram
- `mode=shim`: HTML page with deep link attempt + fallback

### GET /r/:code

Resolve a code to its attribution data. Used by your Telegram bot to retrieve click context.

**Response:**
```json
{
  "success": true,
  "data": {
    "slug": "my-campaign",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "utm": {
      "utm_source": "linkedin",
      "utm_campaign": "q1"
    },
    "extraParams": {},
    "ipHash": "a1b2c3d4e5f6g7h8",
    "userAgent": "Mozilla/5.0...",
    "device": {
      "type": "mobile",
      "os": "iOS",
      "browser": "Safari",
      "hasTelegramApp": true
    },
    "requestId": "uuid-here"
  }
}
```

### GET /r/:code/status

Check if a code exists without consuming it.

**Response:**
```json
{
  "exists": true,
  "resolved": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "botUsername": "MyBot"
}
```

### GET /health, /ready, /live

Health check endpoints for monitoring and orchestration.

## LinkedIn Setup

1. **Create your redirect URL:**
   ```
   https://your-domain.com/tg/your-slug
   ```

2. **In LinkedIn Campaign Manager:**
   - Set destination URL to your redirect URL (must be HTTPS)
   - LinkedIn will append tracking parameters automatically

3. **Test the flow:**
   - Click your ad link
   - Verify Telegram opens (or shim page appears)
   - Check `/r/:code` returns attribution data

**Important:** LinkedIn requires HTTPS URLs. Never use `tg://` as the ad destination.

## Telegram Bot Integration

### Handling /start with Attribution

In your bot's `/start` handler:

```javascript
// Node.js example with node-telegram-bot-api
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const code = match[1];

  // Fetch attribution data
  const response = await fetch(`https://your-domain.com/r/${code}`);
  const { success, data } = await response.json();

  if (success) {
    console.log('Attribution:', {
      campaign: data.utm.utm_campaign,
      source: data.utm.utm_source,
      device: data.device.type,
      timestamp: data.timestamp,
    });

    // Personalize welcome based on campaign
    if (data.utm.utm_campaign === 'sales') {
      bot.sendMessage(chatId, 'Welcome! A sales rep will contact you shortly.');
    } else {
      bot.sendMessage(chatId, 'Welcome to our bot!');
    }
  } else {
    // No attribution - direct /start without code
    bot.sendMessage(chatId, 'Welcome!');
  }
});
```

### Python (python-telegram-bot)

```python
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    code = context.args[0] if context.args else None

    if code:
        async with aiohttp.ClientSession() as session:
            async with session.get(f'https://your-domain.com/r/{code}') as resp:
                data = await resp.json()
                if data.get('success'):
                    attribution = data['data']
                    # Use attribution for analytics/personalization

    await update.message.reply_text('Welcome!')
```

## Deployment

### Vercel (Recommended)

The project is configured for Vercel out of the box.

**1. Install Vercel CLI:**
```bash
npm i -g vercel
```

**2. Deploy:**
```bash
vercel
```

**3. Set environment variables in Vercel Dashboard:**
- `CODE_SIGNING_SECRET` - Secret for signing codes (min 32 chars)
- `IP_HASH_SALT` - Salt for IP hashing
- `ONE_TIME_CODES` - Set to `true` if codes should be single-use
- `RESOLVE_RATE_LIMIT` - Max requests/minute for `/r/:code` (default: 60)

**Important:** On Vercel, the service uses in-memory storage by default since SQLite doesn't persist across serverless invocations. For production with persistent attribution data, use:
- [Vercel KV](https://vercel.com/storage/kv) (Redis)
- [Vercel Postgres](https://vercel.com/storage/postgres)
- External database (PlanetScale, Supabase, etc.)

The `vercel.json` is already configured:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "functions": {
    "api/index.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 10
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY src/config ./src/config
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Systemd

```ini
[Unit]
Description=Telegram Redirect Service
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/telegram-redirect
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck
```

## Architecture

```
src/
├── server.ts           # Fastify server entry point
├── config.ts           # Environment configuration
├── types.ts            # TypeScript type definitions
├── routes/
│   ├── tg.ts           # GET /tg/:slug - main redirect
│   ├── resolve.ts      # GET /r/:code - attribution lookup
│   └── health.ts       # Health check endpoints
├── lib/
│   ├── code.ts         # Code generation/validation
│   ├── shim.ts         # HTML page generator
│   ├── ua.ts           # User-agent parsing
│   ├── slugs.ts        # Slug configuration loader
│   ├── cache.ts        # LRU cache utilities
│   ├── utils.ts        # Common utilities
│   └── storage/
│       ├── interface.ts  # Storage abstraction
│       ├── sqlite.ts     # SQLite implementation
│       └── index.ts
└── config/
    └── slugs.json      # Slug definitions
```

## Security Considerations

1. **No open redirects**: Only destinations defined in `slugs.json` are allowed
2. **Signed codes**: HMAC-signed to prevent forgery
3. **IP hashing**: IPs are hashed with a salt for privacy
4. **Rate limiting**: Resolve endpoint has configurable rate limits
5. **Parameter sanitization**: Dangerous parameters are stripped
6. **Length limits**: All inputs have maximum length constraints

## Migrating to PostgreSQL

The storage interface is designed for easy backend swapping:

```typescript
// Create a PostgresStorage class implementing IStorage
export class PostgresStorage implements IStorage {
  async init(): Promise<void> { /* ... */ }
  async storeCode(mapping: CodeMapping): Promise<void> { /* ... */ }
  async getCode(code: string): Promise<CodeMapping | null> { /* ... */ }
  // ... other methods
}
```

## License

MIT
