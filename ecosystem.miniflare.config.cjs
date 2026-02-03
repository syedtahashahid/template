/**
 * PM2 Configuration for Miniflare Server
 * Auto-restart with aggressive error recovery
 */

module.exports = {
    apps: [
        {
            name: 'test-miniflare-server',
            script: 'npm',
            args: 'run dev:miniflare',
            cwd: '.',
            interpreter: 'none',

            // Environment file - load production environment variables
            env_file: '.env.production',

            // Environment - 24GB heap
            env: {
                NODE_ENV: 'production',
                NODE_OPTIONS: '--max-old-space-size=24576', // 24GB in MB
                PORT: '8899',
            },

            // Auto-restart settings
            autorestart: true,
            watch: false,
            max_memory_restart: '24G',

            // Aggressive restart policies
            min_uptime: '10s',           // Process must stay up 10s to be considered stable
            max_restarts: 100,           // Allow many restarts (for long-running production)
            restart_delay: 2000,         // Wait 2s before restarting
            exp_backoff_restart_delay: 100, // Exponential backoff starting at 100ms

            // Process management
            kill_timeout: 5000,          // 5s grace period for shutdown
            listen_timeout: 30000,       // 30s startup timeout

            // Logging
            error_file: './logs/miniflare-error.log',
            out_file: './logs/miniflare-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
        },
        {
            name: 'test-miniflare-monitor',
            script: 'monitor-miniflare.js',
            cwd: '.',
            interpreter: 'node',

            // Resource limits
            max_memory_restart: '200M',

            // Uptime settings
            min_uptime: '1m',
            max_restarts: 10,

            // Logging
            error_file: './logs/monitor-error.log',
            out_file: './logs/monitor-out.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
