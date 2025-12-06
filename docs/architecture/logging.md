# Logging Architecture

## Overview

HealthChains uses **Winston** for structured logging, replacing all `console.log` calls with a production-ready logging system. This provides log levels, file output, and structured JSON logs for better debugging and monitoring.

## Logging System

### Winston Logger

**Location**: `backend/utils/logger.js`

**Features**:
- **Log Levels**: `debug`, `info`, `warn`, `error`
- **File Output**: 
  - `backend/logs/combined.log` - All logs
  - `backend/logs/error.log` - Errors only
- **Log Rotation**: 5MB max file size, 5 files max
- **Environment-Based**: Different formats for development vs production
- **Structured Logging**: JSON format for parsing and analysis

### Configuration

**Environment Variable**: `LOG_LEVEL`

**Default Behavior**:
- **Development**: `debug` level, colored console output
- **Production**: `info` level, simple console output (warnings and errors only)

**Log Levels**:
- `debug`: Detailed debugging information
- `info`: General informational messages
- `warn`: Warning messages (non-critical issues)
- `error`: Error messages (critical issues)

### Usage

All services use the centralized logger:

```javascript
const logger = require('../utils/logger');

// Info logging
logger.info('Server started', { port: 3001 });

// Warning logging
logger.warn('Cache unavailable', { error: error.message });

// Error logging
logger.error('Database connection failed', { 
  error: error.message, 
  stack: error.stack 
});

// Debug logging (development only)
logger.debug('Processing batch', { batchSize: 50 });
```

### Log Output

**Development Mode** (colored, readable):
```
10:15:05 [info]: Server started {"port":3001,"service":"healthchains-backend"}
10:15:06 [warn]: Cache unavailable {"error":"Connection refused"}
```

**Production Mode** (JSON format):
```json
{"level":"info","message":"Server started","port":3001,"service":"healthchains-backend","timestamp":"2025-12-06 10:15:05"}
{"level":"warn","message":"Cache unavailable","error":"Connection refused","service":"healthchains-backend","timestamp":"2025-12-06 10:15:06"}
```

**File Output** (always JSON):
```json
{"level":"info","message":"Server started","port":3001,"service":"healthchains-backend","timestamp":"2025-12-06 10:15:05"}
{"level":"error","message":"Database connection failed","error":"ECONNREFUSED","stack":"Error: ECONNREFUSED\n    at ...","service":"healthchains-backend","timestamp":"2025-12-06 10:15:07"}
```

## Log Locations

### Console Output

- **Development**: Colored, human-readable format
- **Production**: Simple format (warnings and errors only)

### File Output

**Directory**: `backend/logs/`

**Files**:
- `combined.log`: All log levels (debug, info, warn, error)
- `error.log`: Errors only

**Rotation**:
- Max file size: 5MB
- Max files: 5 (keeps 5 rotated files)
- Automatic rotation when size limit reached

## Logging Best Practices

### 1. Use Appropriate Log Levels

```javascript
// ✅ Good
logger.debug('Processing event', { eventId: 123 }); // Detailed debugging
logger.info('User authenticated', { address: '0x...' }); // General info
logger.warn('Cache miss', { key: 'consent:123' }); // Non-critical issue
logger.error('Database error', { error: error.message }); // Critical error

// ❌ Bad
logger.info('Error occurred', { error: error.message }); // Should be error
logger.error('User logged in', { address: '0x...' }); // Should be info
```

### 2. Include Context

```javascript
// ✅ Good - includes context
logger.error('Failed to fetch consent', { 
  consentId: 123, 
  patient: '0x...',
  error: error.message,
  stack: error.stack 
});

// ❌ Bad - no context
logger.error('Failed to fetch consent');
```

### 3. Structured Data

```javascript
// ✅ Good - structured metadata
logger.info('Event processed', {
  eventType: 'ConsentGranted',
  blockNumber: 12345,
  transactionHash: '0x...',
  processingTime: 45
});

// ❌ Bad - string concatenation
logger.info(`Event processed: ConsentGranted at block 12345`);
```

### 4. Don't Log Sensitive Data

```javascript
// ❌ Bad - logs private key
logger.info('User signed in', { privateKey: user.privateKey });

// ✅ Good - logs public address only
logger.info('User signed in', { address: user.address });
```

## Services Using Logger

All backend services use the centralized logger:

- **`server.js`**: Server startup, initialization, errors
- **`consentService.js`**: Consent operations, event processing, errors
- **`web3Service.js`**: Blockchain connections, contract interactions
- **`cacheService.js`**: Redis operations, connection status
- **`eventIndexer.js`**: PostgreSQL operations, event indexing
- **`authService.js`**: Authentication operations
- **`errorHandler.js`**: Error middleware logging

## Log Analysis

### Viewing Logs

```bash
# View all logs (PM2)
pm2 logs healthchains-backend

# View combined log file
tail -f backend/logs/combined.log

# View error log file
tail -f backend/logs/error.log

# Search logs
grep "error" backend/logs/combined.log

# Count errors
grep -c '"level":"error"' backend/logs/combined.log
```

### Log Parsing

Since logs are in JSON format, they can be easily parsed:

```bash
# Extract all errors
cat backend/logs/combined.log | jq 'select(.level == "error")'

# Count errors by message
cat backend/logs/combined.log | jq -r '.message' | sort | uniq -c

# Find slow operations
cat backend/logs/combined.log | jq 'select(.processingTime > 1000)'
```

## Migration from console.log

All `console.log`, `console.warn`, and `console.error` calls have been replaced with Winston logger:

**Before**:
```javascript
console.log('Server started on port', PORT);
console.warn('Cache unavailable:', error.message);
console.error('Database error:', error);
```

**After**:
```javascript
logger.info('Server started', { port: PORT });
logger.warn('Cache unavailable', { error: error.message });
logger.error('Database error', { error: error.message, stack: error.stack });
```

## Performance Considerations

### Logging Overhead

- **File I/O**: Logs are written asynchronously (non-blocking)
- **JSON Serialization**: Minimal overhead for structured data
- **Log Rotation**: Automatic, doesn't block application

### Best Practices

1. **Use appropriate log levels**: Don't log debug info in production
2. **Batch log writes**: Winston batches writes automatically
3. **Monitor log file sizes**: Automatic rotation prevents disk space issues
4. **Disable verbose logging in production**: Set `LOG_LEVEL=info` or `warn`

## Related Documentation

- [Deployment Guide](../deployment/deployment.md) - Environment configuration
- [Architecture Overview](overview.md) - System architecture
- [Error Handling](../guides/error-handling.md) - Error handling patterns

