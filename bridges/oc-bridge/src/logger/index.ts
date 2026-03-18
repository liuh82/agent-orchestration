/** Simple logger with timestamp and level. */
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

function format(level: LogLevel, msg: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}`;
}

function log(level: LogLevel, msg: string, ...args: unknown[]): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;
  const formatted = format(level, msg);
  if (args.length > 0) {
    console[level](formatted, ...args);
  } else {
    console[level](formatted);
  }
}

export const logger = {
  setLevel(level: LogLevel) {
    currentLevel = level;
  },
  debug(msg: string, ...args: unknown[]) { log("debug", msg, ...args); },
  info(msg: string, ...args: unknown[]) { log("info", msg, ...args); },
  warn(msg: string, ...args: unknown[]) { log("warn", msg, ...args); },
  error(msg: string, ...args: unknown[]) { log("error", msg, ...args); },
};
