import { writeLog } from "./logWriter";
import { LogEntry, LogLevel, LogContext, LogSource } from "../../domain/logTypes";

const SOURCE: LogSource = "APP";

/** Build a structured log entry */
function buildEntry(
  level: LogLevel,
  module: string,
  event: string,
  context?: LogContext
): string {

  const entry: LogEntry = {
    ts: new Date().toISOString(),
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
  context?: LogContext
): Promise<void> {

  try {
    const line = buildEntry(level, module, event, context);
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