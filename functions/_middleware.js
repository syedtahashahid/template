// Basic Middleware Template for Cloudflare Pages
// Preserves HMAC Signature and Database Proxy patterns
// Handles both API routes and Page handlers (worker-style)

import { verifyApiRequest, createAuthErrorResponse } from './utils/auth.js';
import { createDbProxy } from './utils/dbProxy.js';

/**
 * Main Middleware Handler
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 1. Initialize Database Proxy (Default Style)
  const dbServerUrl = env.LOCAL_DB_SERVER_URL || env.DB_PROXY_URL || env.DATABASE_PROXY_URL;
  const apiSecret = env.API_SECRET || env.VITE_API_SECRET;

  let enhancedEnv = { ...env };
  if (dbServerUrl) {
    try {
      enhancedEnv.DB = createDbProxy(dbServerUrl, null, apiSecret, env);
      enhancedEnv.DB.setRequestUrl(request.url);
    } catch (e) {
      console.error('Failed to initialize DB proxy:', e);
    }
  }

  // 2. Routing Logic
  // Using explicit routing to ensure compatibility with Cloudflare Pages bundling

  // A. Home Page
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const handler = await import('./pages/index.js');
    return await handler.onRequestGet({ ...context, env: enhancedEnv });
  }

  // B. API Routes
  if (url.pathname.startsWith('/api/')) {
    // Basic CORS for API
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Signature, X-API-Timestamp',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // HMAC Signature check for /api/*
    const isPublicRoute = url.pathname === '/api/hello';

    if (!isPublicRoute) {
      const auth = await verifyApiRequest(request, apiSecret);
      if (!auth.valid) {
        return createAuthErrorResponse(auth.error || 'Authentication required');
      }
    }

    // Explicit API Routing
    if (url.pathname === '/api/hello' || url.pathname === '/api/hello/') {
      const handler = await import('./api/hello.js');
      const response = await handler.onRequestGet({ ...context, env: enhancedEnv });
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    }

    if (url.pathname === '/api/secure-data' || url.pathname === '/api/secure-data/') {
      const handler = await import('./api/secure-data.js');
      const response = await handler.onRequestPost({ ...context, env: enhancedEnv });
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    }

    return new Response(JSON.stringify({ success: false, error: 'API Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // C. Default: Serve Static Assets from public/
  try {
    return await next();
  } catch (err) {
    return new Response('Not Found', { status: 404 });
  }
}
