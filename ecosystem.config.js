/**
 * PM2 Ecosystem Configuration
 * 
 * Manages both backend and frontend processes
 */

module.exports = {
  apps: [
    {
      name: 'healthchains-backend',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        RPC_URL: process.env.RPC_URL || 'http://127.0.0.1:8545',
        NETWORK_NAME: process.env.NETWORK_NAME || 'localhost',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        POSTGRES_ENABLED: process.env.POSTGRES_ENABLED || 'false',
        POSTGRES_HOST: process.env.POSTGRES_HOST,
        POSTGRES_PORT: process.env.POSTGRES_PORT,
        POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
        POSTGRES_USER: process.env.POSTGRES_USER,
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
    },
    {
      name: 'healthchains-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
        NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '1337',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
    },
  ],
};
