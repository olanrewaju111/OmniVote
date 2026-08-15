/**
 * Lightweight structured logger for OmniVote.
 *
 * In production, replace `console` calls with a proper logging library
 * (pino, winston, or a cloud-provider logger). This module provides
 * a thin abstraction so all log calls go through one place.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  module?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (
  process.env.NODE_ENV === 'production' ? 'info' : 'debug'
);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatPayload(payload: LogPayload): string {
  const { message, module, ...rest } = payload;
  const prefix = module ? `[${module}]` : '';
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${prefix} ${message}${extra}`;
}

export const logger = {
  debug(payload: LogPayload) {
    if (shouldLog('debug')) console.debug(formatPayload(payload));
  },
  info(payload: LogPayload) {
    if (shouldLog('info')) console.info(formatPayload(payload));
  },
  warn(payload: LogPayload) {
    if (shouldLog('warn')) console.warn(formatPayload(payload));
  },
  error(payload: LogPayload & { error?: unknown }) {
    if (shouldLog('error')) console.error(formatPayload(payload));
  },
};
