/**
 * HMAC Signature Verification Utilities for Cloudflare Functions
 * Verifies that API requests are signed with the correct secret
 */

/**
 * Verify HMAC signature for API request
 * @param {string} secret - API secret from environment
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {string} body - Request body (string)
 * @param {number} timestamp - Request timestamp
 * @param {string} signature - Signature to verify
 * @returns {Promise<boolean>} true if signature is valid
 */
async function verifyHMACSignature(secret, method, path, body, timestamp, signature) {
  try {
    // Create the message to sign: method + path + body + timestamp
    const message = `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}`;

    // Generate HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(expectedSignature));
    const expectedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison to prevent timing attacks
    if (expectedHex.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      result |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

/**
 * Check if timestamp is within acceptable window (5 minutes)
 * Prevents replay attacks
 */
function isTimestampValid(timestamp, windowSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= windowSeconds;
}

/**
 * Verify API request authentication
 * @param {Request} request - Incoming request
 * @param {string} apiSecret - API secret from environment
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function verifyApiRequest(request, apiSecret) {
  // Get signature and timestamp from headers
  const signature = request.headers.get('X-API-Signature');
  const timestamp = request.headers.get('X-API-Timestamp');

  if (!signature || !timestamp) {
    return { valid: false, error: 'Missing signature or timestamp headers' };
  }

  // Parse timestamp
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  // Check timestamp validity (prevent replay attacks)
  if (!isTimestampValid(timestampNum)) {
    return { valid: false, error: 'Request timestamp expired or invalid' };
  }

  // Get request body
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const method = request.method;

  // Clone request to read body (body can only be read once)
  const clonedRequest = request.clone();
  let body = '';
  try {
    body = await clonedRequest.text();
  } catch (e) {
    body = '';
  }

  // Verify signature
  const isValid = await verifyHMACSignature(apiSecret, method, path, body, timestampNum, signature);

  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Create error response for authentication failures
 */
export function createAuthErrorResponse(message, status = 401) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    code: 'AUTH_ERROR'
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

