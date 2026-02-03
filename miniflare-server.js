/**
 * Miniflare Local Development Server for Cloudflare Pages Middleware
 * 
 * This script uses wrangler pages dev which uses miniflare under the hood.
 * It provides a simpler interface to serve your middleware locally.
 * 
 * Usage:
 *   node miniflare-server.js
 *   or
 *   npm run dev:miniflare
 * 
 * Prerequisites:
 *   1. Build your Next.js app first: npm run build
 *   2. Ensure you have a .env file with required variables
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8899;
const HOST = process.env.HOST || 'localhost';

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = join(__dirname, '.env');
  const env = {};

  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const equalIndex = trimmed.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            let value = trimmed.substring(equalIndex + 1).trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (key) {
              env[key] = value;
            }
          }
        }
      });
    } catch (error) {
      console.warn('⚠️  Warning: Could not read .env file:', error.message);
    }
  } else {
    console.warn('⚠️  Warning: .env file not found. Environment variables will not be loaded from file.');
  }

  return env;
}

const envVars = loadEnvFile();

// Check if public directory exists
const publicDir = join(__dirname, 'public');
if (!existsSync(publicDir)) {
  console.error('❌ Error: Public directory not found!');
  process.exit(1);
}

console.log('🚀 Starting Miniflare server via Wrangler Pages Dev...\n');
console.log('   This uses Miniflare under the hood to serve your Cloudflare Pages middleware.');
console.log(`\n📋 Configuration:`);
console.log(`   - Host: ${HOST}`);
console.log(`   - Port: ${PORT}`);
console.log(`   - Functions: functions/`);
console.log(`   - Static assets: public/`);
console.log(`\n🌐 Server URL (use HTTP, not HTTPS):`);
console.log(`   👉 http://${HOST}:${PORT} 👈\n`);
console.log('   ⚠️  Note: Use http:// (not https://) for local development\n');
console.log('   ℹ️  Note: If you see "Cannot assign requested address" errors for port 35721,');
console.log('      these are harmless - they relate to hot-reload sockets and can be ignored.\n');
console.log('   Press Ctrl+C to stop the server\n');

// Use wrangler pages dev which uses miniflare
// This is the recommended way to serve Cloudflare Pages middleware locally
// Using only supported flags based on wrangler pages dev help output
const wranglerArgs = [
  'wrangler',
  'pages',
  'dev',
  'public', // serve from public directory
  '--port', String(PORT),
  '--compatibility-date', '2025-12-07', // Explicitly set compatibility date to avoid warnings
];

// Add IP flag (use --ip instead of --host based on wrangler help output)
if (HOST && HOST !== 'localhost') {
  wranglerArgs.push('--ip', HOST);
}

// Add environment variables as bindings
// Important variables for the middleware
const importantVars = [
  'API_SECRET',
  'VITE_API_SECRET',
  'NEXT_PUBLIC_API_SECRET',
  'DB_PROXY_URL',
  'LOCAL_DB_SERVER_URL',
  'DATABASE_PROXY_URL',
  'DB_PROXY_API_KEY',
  'DB_PROXY_HMAC_SECRET',
  'DB_API_KEY',
  'API_KEY',
  'NEXT_PUBLIC_API_URL',
  'NODE_ENV',
  'NEXT_PUBLIC_ADSENSE_CLIENT',
];

// Add all environment variables from .env and process.env as bindings
const allEnv = { ...envVars, ...process.env };
importantVars.forEach(key => {
  const value = allEnv[key];
  if (value !== undefined && value !== null && value !== '') {
    wranglerArgs.push('--binding', `${key}=${value}`);
  }
});

// Also add any other custom environment variables that might be needed
Object.keys(allEnv).forEach(key => {
  // Skip if already added or if it's a system variable we don't want to pass
  if (importantVars.includes(key) || key.startsWith('npm_') || key === 'PATH') {
    return;
  }
  // Only add variables that look like application config (uppercase with underscores)
  if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
    const value = allEnv[key];
    if (value !== undefined && value !== null && value !== '') {
      wranglerArgs.push('--binding', `${key}=${value}`);
    }
  }
});

console.log('🔧 Running command:', 'npx', wranglerArgs.slice(0, 10).join(' '), '... [with bindings]\n');

// Use current process.execPath (node) to run wrangler with specific memory settings
const nodeArgs = [
  '--max-old-space-size=8192', // Hard limit for the Wrangler process itself
  join(__dirname, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  ...wranglerArgs.slice(1) // remove 'wrangler' from the args list since we run the bin directly
];

console.log('🔧 Running command:', process.execPath, nodeArgs.slice(0, 10).join(' '), '... [with bindings]\n');

const wrangler = spawn(process.execPath, nodeArgs, {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false, // Don't use shell so signals are passed correctly
  env: {
    ...process.env,
    ...allEnv,
    // Ensure NODE_OPTIONS matches what we want, though the CLI arg above takes precedence for the main process
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192 --max-semi-space-size=512`.trim()
  }
});

wrangler.on('error', (error) => {
  console.error('\n❌ Failed to start server:', error.message);
  console.error('\n💡 Make sure you have:');
  console.error('   1. Built your Next.js app (npm run build)');
  console.error('   2. Installed dependencies (npm install)');
  console.error('   3. Wrangler CLI available (it should be in devDependencies)');
  process.exit(1);
});

wrangler.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n⚠️  Server exited with code ${code}`);
    process.exit(code);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  wrangler.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down server...');
  wrangler.kill('SIGTERM');
  process.exit(0);
});