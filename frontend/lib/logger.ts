/**
 * Logger Utility
 * 
 * Provides structured logging with environment-based filtering
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }
  
  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') {
      return true;
    }
    
    // Only log other levels in development
    return this.isDevelopment;
  }
  
  log(message: string, ...args: unknown[]): void {
    if (this.shouldLog('log')) {
      const entry = this.formatMessage('log', message, args.length > 0 ? args : undefined);
      console.log(`[LOG] ${entry.timestamp}`, message, ...args);
    }
  }
  
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      const entry = this.formatMessage('info', message, args.length > 0 ? args : undefined);
      console.info(`[INFO] ${entry.timestamp}`, message, ...args);
    }
  }
  
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      const entry = this.formatMessage('warn', message, args.length > 0 ? args : undefined);
      console.warn(`[WARN] ${entry.timestamp}`, message, ...args);
    }
  }
  
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    // Always log errors
    const entry = this.formatMessage('error', message, error || args.length > 0 ? { error, args } : undefined);
    
    if (error instanceof Error) {
      console.error(`[ERROR] ${entry.timestamp}`, message, error, ...args);
    } else {
      console.error(`[ERROR] ${entry.timestamp}`, message, error, ...args);
    }
  }
  
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      const entry = this.formatMessage('debug', message, args.length > 0 ? args : undefined);
      console.debug(`[DEBUG] ${entry.timestamp}`, message, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();


