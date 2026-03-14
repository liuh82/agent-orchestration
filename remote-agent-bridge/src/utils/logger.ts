import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getLogDir } from '../platform/paths.js';

const logDir = getLogDir();
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const contextStr = context ? `[${context}] ` : '';
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      const safeMeta: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(meta)) {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
          safeMeta[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
          safeMeta[key] = JSON.stringify(value, null, 2);
        } else {
          safeMeta[key] = value;
        }
      }
      metaStr = ` ${JSON.stringify(safeMeta)}`;
    }
    return `${timestamp} ${level.toUpperCase()}: ${contextStr}${message}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      format
    ),
  }),
  new winston.transports.File({
    filename: join(logDir, 'error.log'),
    level: 'error',
    format,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: join(logDir, 'combined.log'),
    format,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }),
];

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  transports,
  exitOnError: false,
});

export type LogContext = string | undefined;

export interface LoggerWithContext {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

export function getLogger(context?: string): LoggerWithContext {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, { context, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, { context, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, { context, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, { context, ...meta }),
  };
}
