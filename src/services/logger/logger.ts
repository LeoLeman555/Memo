import { writeLog } from "./logWriter";
import { LogEntry, LogLevel, LogContext, LogSource } from "../../domain/logTypes";

const SOURCE: LogSource = "APP";

/** Unique session identifier for the app runtime */
const SESSION_ID = Math.random().toString(16).slice(2);

/** Minimum log level */
const MIN_LEVEL: LogLevel = "INFO";

/** Log level priority */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
};

/** Check if level should be logged */
function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

/** Build a structured log entry */
function buildEntry(
  level: LogLevel,
  module: string,
  event: string,
  context?: LogContext
): string {

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    session: SESSION_ID,
    level,
    source: SOURCE,
    module,
    event,
    ...(context && Object.keys(context).length > 0 ? { context } : {})
  };

  return JSON.stringify(entry);
}

/** Core logging function */
async function baseLog(
  level: LogLevel,
  module: string,
  event: string,
  context?: LogContext,
): Promise<void> {

  if (!shouldLog(level)) {
    return;
  }

  try {

    const line = buildEntry(level, module, event, context);

    if (__DEV__) {
      console.log(line);
    }

    await writeLog(line);

  } catch {
    // Logging must never crash the application
  }
}

export const Logger = {

  trace(module: string, event: string, context?: LogContext) {
    return baseLog("TRACE", module, event, context);
  },

  debug(module: string, event: string, context?: LogContext) {
    return baseLog("DEBUG", module, event, context);
  },

  info(module: string, event: string, context?: LogContext) {
    return baseLog("INFO", module, event, context);
  },

  warn(module: string, event: string, context?: LogContext) {
    return baseLog("WARN", module, event, context);
  },

  error(module: string, event: string, context?: LogContext) {
    return baseLog("ERROR", module, event, context);
  },

  fatal(module: string, event: string, context?: LogContext) {
    return baseLog("FATAL", module, event, context);
  }

};