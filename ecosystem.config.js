/**
 * PM2 Ecosystem Configuration
 * Production process management configuration
 */

module.exports = {
  apps: [
    {
      name: 'blockfinax-server',
      script: './src/server.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true
    }
  ]
};