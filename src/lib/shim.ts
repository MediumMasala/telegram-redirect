/**
 * HTML shim page generator for Telegram deep linking
 * Design based on WhatsApp bridge landing page
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
      return startParam
        ? `tg://resolve?domain=${encodeURIComponent(destination)}&start=${encodeURIComponent(startParam)}`
        : `tg://resolve?domain=${encodeURIComponent(destination)}`;
    case 'public':
      return `tg://resolve?domain=${encodeURIComponent(destination)}`;
    case 'invite':
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
    title = 'Open Telegram to chat with Tal',
    description = 'Tap the button below to start a conversation',
    fallbackDelay = 1500,
  } = options;

  const deepLink = buildDeepLink(type, destination, startParam);
  const fallbackUrl = buildFallbackUrl(type, destination, startParam);
  const safeDeepLink = escapeHtml(deepLink);
  const safeFallbackUrl = escapeHtml(fallbackUrl);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCode = startParam ? escapeHtml(startParam) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="robots" content="noindex, nofollow">
  <title>${safeTitle}</title>
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0088cc 0%, #0077b5 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .container {
      background: #fff;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }
    .logo { width: 80px; height: 80px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .cta-button {
      display: block;
      width: 100%;
      background: #0088cc;
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 16px 24px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-button:hover { background: #006699; }
    .cta-button:active { transform: scale(0.98); }
    .fallback { margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee; }
    .fallback-link { color: #666; font-size: 13px; text-decoration: underline; cursor: pointer; }
    .fallback-instructions {
      display: none;
      background: #e3f2fd;
      border: 1px solid #90caf9;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      text-align: left;
      font-size: 13px;
      color: #666;
    }
    .fallback-instructions.show { display: block; }
    .fallback-instructions ol { margin-left: 18px; }
    .fallback-instructions li { margin-bottom: 6px; }
    .ref-tag { color: #aaa; font-size: 10px; margin-top: 16px; }
    .direct-link {
      display: block;
      margin-top: 16px;
      color: #0088cc;
      font-size: 14px;
      text-decoration: none;
    }
    .direct-link:hover { text-decoration: underline; }
    @media (max-width: 380px) {
      .container { padding: 24px 16px; }
      h1 { font-size: 20px; }
      .cta-button { font-size: 16px; padding: 14px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="logo" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#0088cc"/>
      <path d="M55.8 24.2L22.1 37.5c-2.3.9-2.3 2.2-.4 2.8l8.6 2.7 3.3 10.1c.4 1.1.8 1.5 1.6 1.5.8 0 1.2-.4 1.7-.8l4.1-4 8.5 6.3c1.6.9 2.7.4 3.1-1.5l5.6-26.4c.5-2.1-.8-3-2.4-2.4zM50.5 31.5L34.3 45.1c-.2.1-.3.3-.3.5l-.9 5.4c0 .2-.3.2-.4 0l-2.4-7.3c-.1-.2 0-.4.2-.5l19.5-12.1c.3-.2.5.1.3.4z" fill="white"/>
    </svg>
    <h1>${safeTitle}</h1>
    <p class="subtitle">${safeDescription}</p>
    <button id="cta" class="cta-button">Open in Telegram App</button>
    <a href="${safeFallbackUrl}" class="direct-link" target="_blank" rel="noopener">Or open in browser →</a>
    <div class="fallback">
      <a id="fallbackToggle" class="fallback-link">Having trouble? Tap here for help</a>
      <div id="fallbackInstructions" class="fallback-instructions">
        <p><strong>If Telegram doesn't open:</strong></p>
        <ol>
          <li>Make sure you have Telegram installed</li>
          <li>If you're in LinkedIn/Twitter app, tap <strong>⋮</strong> or <strong>•••</strong> menu</li>
          <li>Select "<strong>Open in browser</strong>" or "<strong>Open in Safari/Chrome</strong>"</li>
          <li>Then tap "Open in Telegram App" again</li>
        </ol>
        <p style="margin-top: 10px;">Or <a href="${safeFallbackUrl}" target="_blank" rel="noopener" style="color: #0088cc;">click here to open in web</a></p>
      </div>
    </div>
    ${safeCode ? `<div class="ref-tag">ref: ${safeCode.slice(0, 12)}...</div>` : ''}
  </div>
  <script>
    (function() {
      var tgDeepLink = "${safeDeepLink.replace(/"/g, '\\"')}";
      var tgHttps = "${safeFallbackUrl.replace(/"/g, '\\"')}";
      var fallbackDelay = ${fallbackDelay};
      var ctaBtn = document.getElementById('cta');
      var fallbackToggle = document.getElementById('fallbackToggle');
      var fallbackInstructions = document.getElementById('fallbackInstructions');

      // Only redirect when user clicks the button
      ctaBtn.addEventListener('click', function(e) {
        e.preventDefault();

        // Try deep link first
        window.location.href = tgDeepLink;

        // Fallback to https after delay if deep link didn't work
        setTimeout(function() {
          // Check if page is still visible (deep link didn't work)
          if (!document.hidden) {
            window.location.href = tgHttps;
          }
        }, fallbackDelay);
      });

      fallbackToggle.addEventListener('click', function(e) {
        e.preventDefault();
        fallbackInstructions.classList.toggle('show');
      });
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
