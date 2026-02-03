import { exec } from 'child_process';
import http from 'http';

// Configuration
const CHECK_INTERVAL = 4000; // Check every 4 seconds
const TIMEOUT = 5000; // Increased timeout for external network
const TARGET_URL = 'http://localhost:8899/';
const PM2_PROCESS_NAME = 'miniflare-server';
const RESTART_COOLDOWN = 60000; // 1 minute cooldown to prevent restart loops

let lastRestartTime = 0;

function checkServer() {
    const req = http.get(TARGET_URL, (res) => {
        // Just consume the body to free memory, we only care that we got a response
        res.on('data', () => { });
        res.on('end', () => { });

        if (res.statusCode >= 200 && res.statusCode < 500) {
            // Server is healthy
        } else {
            console.warn(`[Monitor] Server returned status ${res.statusCode}`);
            // We treat status codes as "alive" even if 500, unless we want to be very strict.
            // For now, only network errors/timeouts trigger restart.
        }
    });

    req.on('error', (err) => {
        console.error(`[Monitor] Connection failed: ${err.message}`);
        triggerRestart();
    });

    req.setTimeout(TIMEOUT, () => {
        console.error('[Monitor] Request timed out');
        req.destroy();
        triggerRestart();
    });
}

function triggerRestart() {
    const now = Date.now();
    if (now - lastRestartTime < RESTART_COOLDOWN) {
        console.log('[Monitor] Skipping restart due to cooldown period');
        return;
    }

    console.log(`[Monitor] 🚨 Detecting failure. Triggering restart of ${PM2_PROCESS_NAME}...`);
    lastRestartTime = now;

    // Use pm2 reload for zero-downtime if possible, or restart
    exec(`pm2 reload ${PM2_PROCESS_NAME}`, (err, stdout, stderr) => {
        if (err) {
            console.error('[Monitor] ❌ Failed to restart process:', err);
        } else {
            console.log('[Monitor] ✅ Restart command sent successfully');
        }
    });
}

console.log(`[Monitor] Starting watchdog service...`);
console.log(`[Monitor] Target: ${TARGET_URL}`);
console.log(`[Monitor] Interval: ${CHECK_INTERVAL}ms`);

// Start the loop
setInterval(checkServer, CHECK_INTERVAL);

// Initial check
checkServer();
