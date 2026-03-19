import os
import json
import time
import urandom


class Logger:
    """Static structured JSON logger for ESP firmware."""

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

    # --- RAM BUFFER ---
    BUFFER_SIZE = 100
    _buffer = []

    # --- FLASH SNAPSHOT CONFIG ---
    SNAPSHOT_SIZE = 30
    SNAPSHOT_COOLDOWN = 30  # seconds
    _last_snapshot_ts = 0

    SNAPSHOT_DIR = "/flash/logs"

    @staticmethod
    def _now_ms():
        """Return ms since boot (always valid)."""
        return time.ticks_ms()

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
        return {
            "ms": Logger._now_ms(),
            "session": Logger.SESSION,
            "level": level,
            "source": Logger.SOURCE,
            "module": module,
            "event": event,
            "context": context or {}
        }

    @staticmethod
    def _push(entry):
        """Push entry into RAM buffer."""
        if len(Logger._buffer) >= Logger.BUFFER_SIZE:
            Logger._buffer.pop(0)
        Logger._buffer.append(entry)

    @staticmethod
    def _snapshot():
        """Write last logs to flash."""
        now = Logger._now()

        # Anti-spam
        if now - Logger._last_snapshot_ts < Logger.SNAPSHOT_COOLDOWN:
            return

        Logger._last_snapshot_ts = now

        try:
            # Ensure directory
            try:
                os.stat(Logger.SNAPSHOT_DIR)
            except OSError:
                os.mkdir(Logger.SNAPSHOT_DIR)

            # Snapshot last N logs
            snapshot = Logger._buffer[-Logger.SNAPSHOT_SIZE:]

            filename = "%s/log_%d.json" % (
                Logger.SNAPSHOT_DIR,
                now
            )

            with open(filename, "w") as f:
                for entry in snapshot:
                    f.write(json.dumps(entry) + "\n")

        except:
            pass

    @staticmethod
    def _log(level, module, event, context=None):
        """Core logging method."""
        if not Logger._should_log(level):
            return
        try:
            entry = Logger._build_entry(level, module, event, context)

            # console (debug dev)
            print(json.dumps(entry))

            # RAM buffer
            Logger._push(entry)

            # Snapshot only on error/fatal
            if level in ("ERROR", "FATAL"):
                Logger._snapshot()

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