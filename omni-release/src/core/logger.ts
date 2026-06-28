/**
 * omni-release — logger.
 *
 * Tiny dependency-free structured logger. Every stage receives a scoped logger
 * (via LaneRunContext) so log lines are attributable to a lane/run.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Return a child logger that prefixes a scope onto every line. */
  child(scope: string): Logger;
}

export interface LoggerOptions {
  /** Minimum level to emit. Defaults to OMNI_LOG_LEVEL or "info". */
  level?: LogLevel;
  /** Scope label prefixed to messages, e.g. "evening-battle-card". */
  scope?: string;
  /** Emit JSON lines instead of pretty text. Defaults to OMNI_LOG_JSON=1. */
  json?: boolean;
  /** Sink, defaults to console. Injectable for tests. */
  sink?: (level: LogLevel, line: string) => void;
}

function envLevel(): LogLevel {
  const raw = process.env.OMNI_LOG_LEVEL as LogLevel | undefined;
  return raw && raw in LEVEL_ORDER ? raw : "info";
}

function defaultSink(level: LogLevel, line: string): void {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

class BasicLogger implements Logger {
  private readonly level: LogLevel;
  private readonly scope: string;
  private readonly json: boolean;
  private readonly sink: (level: LogLevel, line: string) => void;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? envLevel();
    this.scope = opts.scope ?? "";
    this.json = opts.json ?? process.env.OMNI_LOG_JSON === "1";
    this.sink = opts.sink ?? defaultSink;
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    if (this.json) {
      this.sink(
        level,
        JSON.stringify({ level, scope: this.scope || undefined, message, ...meta }),
      );
      return;
    }
    const prefix = this.scope ? `[${this.scope}]` : "";
    const tag = `${level.toUpperCase().padEnd(5)}`;
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    this.sink(level, `${tag} ${prefix} ${message}${metaStr}`.trim());
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.emit("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.emit("error", message, meta);
  }

  child(scope: string): Logger {
    const nextScope = this.scope ? `${this.scope}:${scope}` : scope;
    return new BasicLogger({
      level: this.level,
      scope: nextScope,
      json: this.json,
      sink: this.sink,
    });
  }
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  return new BasicLogger(opts);
}

/** Shared default logger for callers that don't need a scoped instance. */
export const logger: Logger = createLogger();
