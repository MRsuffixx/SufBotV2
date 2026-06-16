import { mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  type LogContext,
  type LogEntry,
  type LogLevel,
  type LogTransport,
  type LoggerOptions,
  shouldLog,
} from '@bot/shared/logger';
import { getEnv } from '../config/env.js';

const DEFAULT_SERVICE = 'bot';

function nowIso(): string {
  return new Date().toISOString();
}

function serializeError(err: unknown): LogEntry['error'] {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'NonError', message: String(err) };
}

function buildEntry(
  service: string,
  level: LogLevel,
  message: string,
  context?: LogContext,
  err?: unknown,
): LogEntry {
  const entry: LogEntry = {
    timestamp: nowIso(),
    level,
    service,
    message,
  };
  if (context && Object.keys(context).length > 0) entry.context = context;
  if (err !== undefined) entry.error = serializeError(err);
  return entry;
}

const consoleTransport: LogTransport = (entry) => {
  const env = getEnv();
  if (env.LOG_FORMAT === 'pretty' && process.stdout.isTTY) {
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const err = entry.error ? ` err=${entry.error.message}` : '';
    // eslint-disable-next-line no-console
    console.log(
      `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.service}: ${entry.message}${ctx}${err}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }
};

function makeFileTransport(filePath: string): LogTransport {
  return async (entry) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  };
}

export class Logger {
  private readonly service: string;
  private readonly level: LogLevel;
  private readonly transports: LogTransport[];
  private readonly baseContext: LogContext;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.level = options.level ?? 'info';
    this.transports = options.transports ?? [consoleTransport];
    this.baseContext = options.baseContext ?? {};
  }

  child(extra: LogContext): Logger {
    return new Logger({
      service: this.service,
      level: this.level,
      transports: this.transports,
      baseContext: { ...this.baseContext, ...extra },
    });
  }

  debug(message: string, context?: LogContext): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit('warn', message, context);
  }

  error(message: string, err?: unknown, context?: LogContext): void {
    this.emit('error', message, context, err);
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: LogContext,
    err?: unknown,
  ): void {
    if (!shouldLog(level, this.level)) return;
    const merged: LogContext | undefined =
      context || Object.keys(this.baseContext).length > 0
        ? { ...this.baseContext, ...context }
        : undefined;
    const entry = buildEntry(this.service, level, message, merged, err);
    for (const t of this.transports) {
      try {
        const result = t(entry);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => undefined);
        }
      } catch {
        // Transports must never throw — failures are swallowed to avoid loops.
      }
    }
  }
}

let rootLogger: Logger | undefined;

export function getLogger(): Logger {
  if (rootLogger) return rootLogger;
  const env = getEnv();
  const transports: LogTransport[] = [consoleTransport];
  if (process.env.NODE_ENV === 'production') {
    const logsDir = process.env.LOG_DIR ?? path.resolve(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      // best-effort mkdir is handled by the transport
    }
    transports.push(makeFileTransport(path.join(logsDir, 'app.log')));
    transports.push(makeFileTransport(path.join(logsDir, 'error.log')));
  }
  rootLogger = new Logger({
    service: DEFAULT_SERVICE,
    level: env.LOG_LEVEL,
    transports,
  });
  return rootLogger;
}

export function setLogger(logger: Logger): void {
  rootLogger = logger;
}
