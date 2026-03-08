import os
import json
import time
import urandom


class Logger:
    """Structured JSON logger for ESP32."""
    LOG_DIR = "/sd/logs"
    LEVEL_PRIORITY = {
        "TRACE": 10,
        "DEBUG": 20,
        "INFO": 30,
        "WARN": 40,
        "ERROR": 50,
        "FATAL": 60,
    }
    def __init__(self, source="ESP", min_level="INFO"):
        """Initialize logger."""
        self.source = source
        self.min_level = min_level
        self.session = hex(urandom.getrandbits(32))[2:]
        self.initialized = False

    def _now_iso(self):
        """Return ISO8601 timestamp."""
        t = time.localtime()
        return "%04d-%02d-%02dT%02d:%02d:%02dZ" % (
            t[0], t[1], t[2],
            t[3], t[4], t[5]
        )

    def _today_file(self):
        """Return log file path for current day."""
        t = time.localtime()
        filename = "esp-%04d-%02d-%02d.log" % (
            t[0], t[1], t[2]
        )
        return "%s/%s" % (self.LOG_DIR, filename)

    def _ensure_initialized(self):
        """Ensure log directory exists."""
        if self.initialized:
            return
        try:
            os.mkdir(self.LOG_DIR)
        except:
            pass
        self.initialized = True

    def _should_log(self, level):
        """Check if log level should be recorded."""
        return (
            self.LEVEL_PRIORITY[level]
            >= self.LEVEL_PRIORITY[self.min_level]
        )

    def _build_entry(self, level, module, event, context):
        """Build structured log entry."""
        entry = {
            "ts": self._now_iso(),
            "session": self.session,
            "level": level,
            "source": self.source,
            "module": module,
            "event": event
        }
        if context and len(context) > 0:
            entry["context"] = context
        return json.dumps(entry)

    def _write(self, line):
        """Append log line to file."""
        try:
            self._ensure_initialized()
            path = self._today_file()
            with open(path, "a") as f:
                f.write(line + "\n")
        except:
            pass

    def _log(self, level, module, event, context=None):
        """Core logging function."""
        if not self._should_log(level):
            return
        try:
            line = self._build_entry(level, module, event, context)
            print(line)
            self._write(line)
        except:
            pass

    def trace(self, module, event, context=None):
        """TRACE level log."""
        self._log("TRACE", module, event, context)

    def debug(self, module, event, context=None):
        """DEBUG level log."""
        self._log("DEBUG", module, event, context)

    def info(self, module, event, context=None):
        """INFO level log."""
        self._log("INFO", module, event, context)

    def warn(self, module, event, context=None):
        """WARN level log."""
        self._log("WARN", module, event, context)

    def error(self, module, event, context=None):
        """ERROR level log."""
        self._log("ERROR", module, event, context)

    def fatal(self, module, event, context=None):
        """FATAL level log."""
        self._log("FATAL", module, event, context)