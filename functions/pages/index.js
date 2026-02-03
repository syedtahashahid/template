/**
 * Index Page Handler
 * Handles GET /
 */
export async function onRequestGet(context) {
    const { env } = context;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Worker Template</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 800px; margin: 40px auto; padding: 20px; color: #374151; }
        h1 { color: #111827; }
        .card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-top: 20px; }
        code { background: #e5e7eb; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
      </style>
    </head>
    <body>
      <h1>Welcome to your Worker Template</h1>
      <p>This page is served directly by a Cloudflare Pages Middleware handler.</p>
      
      <div class="card">
        <h3>System Status</h3>
        <ul>
          <li><strong>Database Proxy:</strong> ${env.DB ? 'Configured' : 'Not Configured'}</li>
          <li><strong>Routing:</strong> Pure Middleware</li>
          <li><strong>Framework:</strong> None (Vanilla JS)</li>
        </ul>
      </div>

      <div class="card">
        <h3>Example Endpoints</h3>
        <ul>
          <li><a href="/api/hello">GET /api/hello</a> (Public)</li>
          <li><code>POST /api/secure-data</code> (HMAC Required)</li>
        </ul>
      </div>

      <p>To add more pages, create files in <code>functions/pages/</code>. For example, <code>functions/pages/about.js</code> will handle <code>/about</code>.</p>
    </body>
    </html>
  `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
}
