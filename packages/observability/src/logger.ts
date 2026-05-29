import { pino, type Logger, type LoggerOptions } from 'pino';
import { trace, isSpanContextValid } from '@opentelemetry/api';

export type { Logger } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface CreateLoggerOptions {
  serviceName: string;
  env: 'development' | 'production' | 'test';
  level?: LogLevel;
  base?: Record<string, unknown>;
  extraRedactions?: string[];
}

const DEFAULT_REDACTIONS = [
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.apiKey',
  '*.api_key',
  '*.encryptedApiKey',
  '*.encrypted_api_key',
  '*.encryptionKey',
  '*.token',
  '*.embedToken',
  '*.embed_token',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

export function createLogger(options: CreateLoggerOptions): Logger {
  const { serviceName, env, level, base, extraRedactions } = options;
  const opts: LoggerOptions = {
    name: serviceName,
    level: level ?? (env === 'production' ? 'info' : 'debug'),
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: serviceName,
      env,
      ...base,
    },
    redact: {
      paths: [...DEFAULT_REDACTIONS, ...(extraRedactions ?? [])],
      censor: '[REDACTED]',
    },
    mixin() {
      const span = trace.getActiveSpan();
      const ctx = span?.spanContext();
      if (ctx && isSpanContextValid(ctx)) {
        return { trace_id: ctx.traceId, span_id: ctx.spanId };
      }
      return {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return pino(opts);
}
