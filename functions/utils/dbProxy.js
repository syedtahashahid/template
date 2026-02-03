/**
 * Database Proxy Client
 * Routes database queries to PostgreSQL server via HTTP API
 * All requests use the database proxy (database.example.com)
 */

class D1StatementProxy {
  constructor(proxyClient, query, params = []) {
    this.proxyClient = proxyClient;
    this.query = query;
    this.params = params;
  }

  bind(...values) {
    this.params = values;
    return this;
  }

  async first() {
    const result = await this.proxyClient.executeQuery('first', this.query, this.params);
    // If it's an array with results, return the first one
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    // If it's an array with no results, return null
    if (Array.isArray(result) && result.length === 0) {
      return null;
    }
    // If it's already an object (or null), return as is
    return result;
  }

  async all() {
    const result = await this.proxyClient.executeQuery('all', this.query, this.params);
    // Ensure we return the { results: [...] } format expected by D1/the app
    if (Array.isArray(result)) {
      return { results: result, meta: {} };
    }
    if (result && typeof result === 'object' && !result.results) {
      // If it's an object but missing 'results', it might be a single row or other format
      // In D1, .all() should always have .results
      return { results: [result], meta: {} };
    }
    if (!result) {
      return { results: [], meta: {} };
    }
    return result;
  }

  async run() {
    const result = await this.proxyClient.executeQuery('run', this.query, this.params);
    // D1 .run() returns an object with success info
    if (result && typeof result === 'object') {
      return result;
    }
    return { success: true, result };
  }
}

class D1Proxy {
  constructor(serverUrl, apiKey = null, hmacSecret = null) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.hmacSecret = hmacSecret;
    this.enabled = !!serverUrl;
    this.lastError = null;
    this.errorCount = 0;
    this.maxErrors = 5; // Disable proxy after 5 consecutive errors
    this.currentRequestUrl = null; // Store current request URL for error logging
  }

  /**
   * Set the current request URL for error logging context
   * @param {string} url - The request URL
   */
  setRequestUrl(url) {
    this.currentRequestUrl = url;
  }

  /**
   * Generate HMAC signature for request
   * Compatible with Cloudflare Functions HMAC implementation
   */
  async generateHMACSignature(secret, method, path, body, timestamp) {
    const message = `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  async executeQuery(operation, query, params = [], requestUrl = null) {
    if (!this.enabled || !this.serverUrl) {
      throw new Error('Database proxy not configured');
    }

    // Use provided requestUrl or fall back to stored currentRequestUrl
    const urlForLogging = requestUrl || this.currentRequestUrl || null;

    try {
      const body = JSON.stringify({
        operation,
        query,
        params,
        requestUrl: urlForLogging,
      });
      // Server's HMAC middleware is mounted at /api/db, so req.path is /query (relative to mount)
      const pathForSignature = '/query';
      const pathForUrl = '/api/db/query';
      const timestamp = Math.floor(Date.now() / 1000);

      const headers = {
        'Content-Type': 'application/json',
      };

      // Generate HMAC signature if secret is provided
      if (this.hmacSecret) {
        try {
          const signature = await this.generateHMACSignature(this.hmacSecret, 'POST', pathForSignature, body, timestamp);
          headers['X-API-Signature'] = signature;
          headers['X-API-Timestamp'] = timestamp.toString();
        } catch (err) {
          console.error('Failed to generate HMAC signature:', err);
        }
      }

      // Add API key as fallback if HMAC is not used
      if (this.apiKey && !this.hmacSecret) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(`${this.serverUrl}${pathForUrl}`, {
        method: 'POST',
        headers: headers,
        body: body,
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Database query failed');
      }

      // Reset error count on success
      this.errorCount = 0;
      this.lastError = null;

      // Return data in compatible format
      if (operation === 'all') {
        return result.data; // Already in { results: [...] } format
      }
      return result.data;
    } catch (error) {
      this.lastError = error;
      this.errorCount++;

      // Temporary backoff if too many errors, but don't disable permanently
      if (this.errorCount >= this.maxErrors) {
        const backoffSeconds = Math.min(30, Math.pow(2, this.errorCount - this.maxErrors));
        console.warn(`Database proxy encountered ${this.errorCount} consecutive errors. Last error: ${error.message}. Backing off for ${backoffSeconds}s.`);

        // We don't set this.enabled = false anymore to allow recovery
        // But we could implement a pause mechanism if needed
      }

      throw error;
    }
  }

  prepare(query) {
    return new D1StatementProxy(this, query);
  }

  async batch(statements) {
    if (!this.enabled || !this.serverUrl) {
      throw new Error('Database proxy not configured');
    }

    try {
      // Convert statements to batch format
      const batchStatements = statements.map(stmt => ({
        query: typeof stmt === 'string' ? stmt : stmt.sql || stmt.query,
        params: stmt.params || stmt.args || [],
      }));

      const body = JSON.stringify({
        operation: 'batch',
        query: '', // Not used for batch
        params: batchStatements,
      });
      // Server's HMAC middleware is mounted at /api/db, so req.path is /query (relative to mount)
      const pathForSignature = '/query';
      const pathForUrl = '/api/db/query';
      const timestamp = Math.floor(Date.now() / 1000);

      const headers = {
        'Content-Type': 'application/json',
      };

      // Generate HMAC signature if secret is provided
      if (this.hmacSecret) {
        try {
          const signature = await this.generateHMACSignature(this.hmacSecret, 'POST', pathForSignature, body, timestamp);
          headers['X-API-Signature'] = signature;
          headers['X-API-Timestamp'] = timestamp.toString();
        } catch (err) {
          console.error('Failed to generate HMAC signature:', err);
        }
      }

      // Add API key as fallback if HMAC is not used
      if (this.apiKey && !this.hmacSecret) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(`${this.serverUrl}${pathForUrl}`, {
        method: 'POST',
        headers: headers,
        body: body,
        signal: AbortSignal.timeout(30000), // Longer timeout for batch
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Database batch failed');
      }

      this.errorCount = 0;
      this.lastError = null;
      return result.data;
    } catch (error) {
      this.lastError = error;
      this.errorCount++;

      if (this.errorCount >= this.maxErrors) {
        console.warn(`Database proxy batch disabled after ${this.maxErrors} consecutive errors. Last error: ${error.message}`);
        // We don't set this.enabled = false anymore to allow recovery
      }

      throw error;
    }
  }

  async exec(query) {
    // exec is typically used for DDL statements
    // We'll use run() for compatibility
    const result = await this.executeQuery('run', query, []);
    return result;
  }

  async healthCheck() {
    if (!this.serverUrl) return false;

    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a database proxy instance
 * @param {string} serverUrl - URL of the database proxy server (e.g., 'https://database.example.com')
 * @param {string} apiKey - Optional API key for authentication (fallback)
 * @param {string} hmacSecret - Optional HMAC secret for authentication (VITE_API_SECRET)
 * @param {object} env - Optional environment object to check for missing variables
 * @returns {D1Proxy} - Proxy instance
 */
export function createDbProxy(serverUrl, apiKey = null, hmacSecret = null, env = null) {
  if (!serverUrl || serverUrl.trim() === '') {
    throw new Error('Database proxy server URL is required');
  }

  // If HMAC secret is not provided, try to get it from environment variables
  // Check multiple possible variable names for compatibility
  if (!hmacSecret && env) {
    hmacSecret = env.API_SECRET || env.VITE_API_SECRET || env.NEXT_PUBLIC_API_SECRET || null;
  }

  // If still no HMAC secret, try global environment (Cloudflare Pages context)
  if (!hmacSecret) {
    try {
      // In Cloudflare Pages Functions, env vars are available in the global context
      // Try to access them - this is a fallback
      if (typeof process !== 'undefined' && process.env) {
        hmacSecret = process.env.API_SECRET || process.env.VITE_API_SECRET || process.env.NEXT_PUBLIC_API_SECRET || null;
      }
    } catch (e) {
      // Ignore errors accessing process.env
    }
  }

  // Warn if HMAC secret is missing (server will reject requests)
  if (!hmacSecret) {
    console.warn('Database proxy: HMAC secret not provided. Database requests may fail with "Missing signature or timestamp headers" error. Set API_SECRET, VITE_API_SECRET, or NEXT_PUBLIC_API_SECRET environment variable.');
  }

  return new D1Proxy(serverUrl.trim(), apiKey, hmacSecret);
}

/**
 * Helper function to create database proxy from environment variables
 * This should be used in Cloudflare Pages Functions middleware
 * @param {object} env - Environment object from Cloudflare Pages Functions context
 * @returns {D1Proxy|null} - Proxy instance or null if not configured
 */
export function createDbProxyFromEnv(env) {
  if (!env) {
    console.error('Database proxy: Environment object not provided');
    return null;
  }

  // Get database proxy URL from environment
  // Check multiple possible variable names
  const dbServerUrl = env.LOCAL_DB_SERVER_URL || env.DB_PROXY_URL || env.DATABASE_PROXY_URL || null;

  if (!dbServerUrl) {
    console.warn('Database proxy: Server URL not found in environment variables. Set LOCAL_DB_SERVER_URL, DB_PROXY_URL, or DATABASE_PROXY_URL.');
    return null;
  }

  // Get HMAC secret from environment
  // Check multiple possible variable names for compatibility
  const hmacSecret = env.API_SECRET || env.VITE_API_SECRET || env.NEXT_PUBLIC_API_SECRET || null;

  if (!hmacSecret) {
    console.error('Database proxy: HMAC secret not found in environment variables. Database requests will fail. Set API_SECRET, VITE_API_SECRET, or NEXT_PUBLIC_API_SECRET in Cloudflare Pages environment variables.');
  }

  // Get API key as fallback (optional)
  const apiKey = env.DB_API_KEY || env.API_KEY || null;

  return createDbProxy(dbServerUrl, apiKey, hmacSecret, env);
}

export default D1Proxy;

