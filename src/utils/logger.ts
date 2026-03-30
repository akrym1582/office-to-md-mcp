export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (levels[level] < levels[LOG_LEVEL]) return;
  const line = context
    ? `[${level.toUpperCase()}] ${message} ${JSON.stringify(context)}`
    : `[${level.toUpperCase()}] ${message}`;
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
