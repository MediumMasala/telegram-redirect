/**
 * Vercel Serverless Function Handler
 *
 * This catches all requests and routes them through Fastify.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamic import to handle ESM
let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = import('../dist/vercel.js').then((m) => m.buildVercelApp());
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();

    // Fastify's inject method for serverless
    const response = await app.inject({
      method: req.method as any,
      url: req.url,
      headers: req.headers as Record<string, string>,
      payload: req.body,
      query: req.query as Record<string, string>,
    });

    // Set response headers
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    }

    // Send response
    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? String(error) : 'An error occurred',
    });
  }
}
