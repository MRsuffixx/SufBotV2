export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export type LogTransport = (entry: LogEntry) => void | Promise<void>;

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  transports?: LogTransport[];
  baseContext?: LogContext;
}

export function shouldLog(currentLevel: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_RANK[currentLevel] >= LOG_LEVEL_RANK[threshold];
}
