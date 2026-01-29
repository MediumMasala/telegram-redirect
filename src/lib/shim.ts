/**
 * HTML shim page generator for Telegram deep linking
 *
 * The shim page:
 * 1. Attempts to open the Telegram app using tg:// protocol
 * 2. Falls back to https://t.me/ after a delay
 * 3. Shows a manual button as a backup
 */

import type { TelegramDestinationType } from '../types.js';

/** Escape HTML special characters */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Generate OG meta tags for link previews */
function generateOgTags(title: string, description: string): string {
  return `
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  `;
}

interface ShimOptions {
  /** Type of Telegram destination */
  type: TelegramDestinationType;
  /** Destination identifier (username, hash, or bot username) */
  destination: string;
  /** For bot type: the start parameter (code) */
  startParam?: string;
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Delay before fallback in milliseconds */
  fallbackDelay?: number;
}

/**
 * Build the tg:// deep link URL based on destination type
 */
function buildDeepLink(type: TelegramDestinationType, destination: string, startParam?: string): string {
  switch (type) {
    case 'bot':
      // tg://resolve?domain=BotUsername&start=payload
      return startParam
        ? `tg://resolve?domain=${encodeURIComponent(destination)}&start=${encodeURIComponent(startParam)}`
        : `tg://resolve?domain=${encodeURIComponent(destination)}`;
    case 'public':
      // tg://resolve?domain=username
      return `tg://resolve?domain=${encodeURIComponent(destination)}`;
    case 'invite':
      // tg://join?invite=hash
      return `tg://join?invite=${encodeURIComponent(destination)}`;
  }
}

/**
 * Build the https://t.me/ fallback URL
 */
function buildFallbackUrl(type: TelegramDestinationType, destination: string, startParam?: string): string {
  switch (type) {
    case 'bot':
      return startParam
        ? `https://t.me/${encodeURIComponent(destination)}?start=${encodeURIComponent(startParam)}`
        : `https://t.me/${encodeURIComponent(destination)}`;
    case 'public':
      return `https://t.me/${encodeURIComponent(destination)}`;
    case 'invite':
      return `https://t.me/+${encodeURIComponent(destination)}`;
  }
}

/**
 * Generate the HTML shim page
 */
export function generateShimHtml(options: ShimOptions): string {
  const {
    type,
    destination,
    startParam,
    title = 'Opening Telegram...',
    description = 'Redirecting you to Telegram',
    fallbackDelay = 1000,
  } = options;

  const deepLink = buildDeepLink(type, destination, startParam);
  const fallbackUrl = buildFallbackUrl(type, destination, startParam);
  const escapedFallbackUrl = escapeHtml(fallbackUrl);
  const escapedDeepLink = escapeHtml(deepLink);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  ${generateOgTags(title, description)}
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #0088cc 0%, #0077b5 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .logo {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    p {
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e0e0e0;
      border-top-color: #0088cc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      background: #0088cc;
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #006699;
    }
    .fallback {
      margin-top: 16px;
      font-size: 14px;
      color: #888;
    }
    .fallback a {
      color: #0088cc;
    }
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="logo" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="120" r="120" fill="#0088cc"/>
      <path d="M98 175c-3.9 0-3.2-1.5-4.6-5.2L82 132.2 176 72" fill="#c8daea"/>
      <path d="M98 175c3 0 4.3-1.4 6-3l16-15.6-20-12" fill="#a9c9dd"/>
      <path d="M100 144.4l48.4 35.7c5.5 3 9.5 1.5 10.9-5.1l19.7-93c2-8-3-11.6-8.4-9.2L52 107.5c-7.8 3.1-7.7 7.5-1.4 9.5l36.4 11.4 84.4-53.2c4-2.4 7.6-.8 4.6 1.5" fill="#fff"/>
    </svg>
    <div class="spinner" id="spinner"></div>
    <h1>${escapeHtml(title)}</h1>
    <p>We're opening Telegram for you. If it doesn't open automatically, tap the button below.</p>
    <a href="${escapedFallbackUrl}" class="btn" id="openBtn">Open Telegram</a>
    <p class="fallback">
      Having trouble? <a href="${escapedFallbackUrl}">Click here</a>
    </p>
  </div>
  <script>
    (function() {
      var deepLink = '${escapedDeepLink.replace(/'/g, "\\'")}';
      var fallbackUrl = '${escapedFallbackUrl.replace(/'/g, "\\'")}';
      var fallbackDelay = ${fallbackDelay};
      var fallbackTimer;
      var hasRedirected = false;

      function redirect() {
        if (hasRedirected) return;
        hasRedirected = true;
        window.location.href = fallbackUrl;
      }

      // Try deep link
      function tryDeepLink() {
        // Create hidden iframe to try tg:// link (less intrusive)
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);

        // Also try direct navigation for some browsers
        setTimeout(function() {
          window.location.href = deepLink;
        }, 100);

        // Set up fallback
        fallbackTimer = setTimeout(redirect, fallbackDelay);
      }

      // Cancel fallback if page becomes hidden (app opened)
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
        }
      });

      // Also detect blur (app switch)
      window.addEventListener('blur', function() {
        clearTimeout(fallbackTimer);
      });

      // Start the process
      tryDeepLink();
    })();
  </script>
</body>
</html>`;
}

/**
 * Get the direct redirect URL for a destination (no shim page)
 */
export function getDirectRedirectUrl(
  type: TelegramDestinationType,
  destination: string,
  startParam?: string
): string {
  return buildFallbackUrl(type, destination, startParam);
}
