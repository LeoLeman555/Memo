import os
import json
import time
import urandom


class Logger:
    """Static structured JSON logger for ESP firmware."""
    LOG_DIR = "/sd/logs"
    SOURCE = "ESP"
    SESSION = hex(urandom.getrandbits(32))[2:]
    MIN_LEVEL = "DEBUG"
    LEVEL_PRIORITY = {
        "TRACE": 10,
        "DEBUG": 20,
        "INFO": 30,
        "WARN": 40,
        "ERROR": 50,
        "FATAL": 60,
    }
    _initialized = False
    _write_lock = False

    @staticmethod
    def configure(root):
        """Configure log directory from storage backend."""
        Logger.LOG_DIR = "%s/logs" % root

    @staticmethod
    def _now_iso():
        """Return ISO8601 timestamp."""
        t = time.localtime()
        return "%04d-%02d-%02dT%02d:%02d:%02dZ" % (
            t[0], t[1], t[2],
            t[3], t[4], t[5]
        )

    @staticmethod
    def _today_file():
        """Return today's log file path."""
        if Logger.LOG_DIR is None:
            return None
        t = time.localtime()
        filename = "esp-%04d-%02d-%02d.log" % (
            t[0], t[1], t[2]
        )
        return "%s/%s" % (Logger.LOG_DIR, filename)

    @staticmethod
    def _ensure_initialized():
        """Ensure log directory exists."""
        if Logger._initialized:
            return

        try:
            os.stat(Logger.LOG_DIR)
        except OSError:
            os.mkdir(Logger.LOG_DIR)

        Logger._initialized = True

    @staticmethod
    def _should_log(level):
        """Check if level should be logged."""
        return (
            Logger.LEVEL_PRIORITY[level]
            >= Logger.LEVEL_PRIORITY[Logger.MIN_LEVEL]
        )

    @staticmethod
    def _build_entry(level, module, event, context):
        """Create structured log entry."""
        entry = {
            "ts": Logger._now_iso(),
            "session": Logger.SESSION,
            "level": level,
            "source": Logger.SOURCE,
            "module": module,
            "event": event
        }
        if context and len(context) > 0:
            entry["context"] = context
        return json.dumps(entry)

    @staticmethod
    def _write(line):
        """Append log line to storage."""
        if Logger._write_lock:
            return
        if not Logger.LOG_DIR:
            return

        try:
            Logger._write_lock = True
            Logger._ensure_initialized()

            path = Logger._today_file()
            with open(path, "a") as f:
                f.write(line + "\n")

        except:
            pass
        finally:
            Logger._write_lock = False

    @staticmethod
    def _log(level, module, event, context=None):
        """Core logging method."""
        if not Logger._should_log(level):
            return
        try:
            line = Logger._build_entry(level, module, event, context)
            print(line)
            # Logger._write(line)

        except:
            pass

    # Public API

    @staticmethod
    def trace(module, event, context=None):
        """TRACE level log."""
        Logger._log("TRACE", module, event, context)

    @staticmethod
    def debug(module, event, context=None):
        """DEBUG level log."""
        Logger._log("DEBUG", module, event, context)

    @staticmethod
    def info(module, event, context=None):
        """INFO level log."""
        Logger._log("INFO", module, event, context)

    @staticmethod
    def warn(module, event, context=None):
        """WARN level log."""
        Logger._log("WARN", module, event, context)

    @staticmethod
    def error(module, event, context=None):
        """ERROR level log."""
        Logger._log("ERROR", module, event, context)

    @staticmethod
    def fatal(module, event, context=None):
        """FATAL level log."""
        Logger._log("FATAL", module, event, context)