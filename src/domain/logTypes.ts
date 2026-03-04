// Log severity levels
export type LogLevel =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL";

// Log source
export type LogSource =
  | "APP"
  | "ESP";

// Log context object
export type LogContext = Record<string, unknown>;

// Standard log entry structure
export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: LogSource;
  module: string;
  event: string;
  context?: LogContext;
}

// Optional runtime configuration
export interface LoggerConfig {
  source: LogSource;
}