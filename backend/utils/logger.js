const winston = require('winston');
const path = require('path');

/**
 * Centralized Logger Service
 * 
 * Replaces console.log/warn/error with structured logging using Winston.
 * Provides log levels, file output, and production-ready logging.
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started');
 *   logger.error('Error occurred', { error: error.message });
 */

// Determine log level from environment (default: info)
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'healthchains-backend' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add console transport for development (or if not in test)
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug', // Show all logs in development
  }));
} else if (process.env.NODE_ENV === 'production') {
  // In production, only log warnings and errors to console
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'warn',
  }));
}

// Create logs directory if it doesn't exist (synchronous for startup)
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;

