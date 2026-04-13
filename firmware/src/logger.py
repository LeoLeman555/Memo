import os
import json
import time
import urandom


class Logger:
    """Efficient structured logger with flash persistence."""

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

    LOG_DIR = "/flash/logs"
    SYSTEM_FILE = LOG_DIR + "/system.log"
    BATTERY_FILE = LOG_DIR + "/battery.log"

    BUFFER = []
    BUFFER_LIMIT = 10

    LAST_FLUSH = 0
    LAST_LOG_TIME = 0

    FLUSH_INTERVAL = 5  # seconds
    LONG_INTERVAL_THRESHOLD = 120  # seconds

    MAX_FILE_SIZE = 200_000  # 200 KB

    DIR_READY = False
    ENABLE_CONSOLE = True

    @staticmethod
    def _now():
        """Return timestamp."""
        return int(time.time())

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
            "time": Logger._now(),
            "session": Logger.SESSION,
            "level": level,
            "source": Logger.SOURCE,
            "module": module,
            "event": event,
            "context": context or {}
        }

    @staticmethod
    def _ensure_dir():
        """Ensure log directory exists."""
        if Logger.DIR_READY:
            return
        try:
            os.stat(Logger.LOG_DIR)
        except Exception:
            try:
                os.mkdir(Logger.LOG_DIR)
            except Exception as e:
                print("Logger mkdir error:", e)
        Logger.DIR_READY = True

    @staticmethod
    def _rotate_if_needed(path):
        """Rotate file if too large."""
        try:
            size = os.stat(path)[6]
            if size > Logger.MAX_FILE_SIZE:
                old_path = path + ".old"

                try:
                    os.stat(old_path)
                    os.remove(old_path)
                except Exception:
                    pass

                os.rename(path, old_path)
        except Exception as e:
            print("Logger rotate error:", e)

    @staticmethod
    def _flush():
        """Write buffer to flash."""
        if not Logger.BUFFER:
            return

        Logger._ensure_dir()

        try:
            with open(Logger.SYSTEM_FILE, "a") as f:
                for entry in Logger.BUFFER:
                    f.write(json.dumps(entry, separators=(",", ":")) + "\n")

            Logger._rotate_if_needed(Logger.SYSTEM_FILE)

        except Exception as e:
            print("Logger flush error:", e)

        Logger.BUFFER = []
        Logger.LAST_FLUSH = Logger._now()

    @staticmethod
    def log_battery(data):
        """Dedicated battery log."""
        Logger._ensure_dir()

        entry = {
            "time": int(data.get("time", Logger._now())),
            "voltage": round(data.get("voltage", 0), 3),
            "percent": round(data.get("percent", 0), 1),
            "state": data.get("state"),
            "consumption_vph": round(data.get("consumption_v_per_h", 0), 4),
            "raw": round(data.get("raw", 0), 1),
            "dt": data.get("dt"),
            "dv": data.get("dv")
        }

        try:
            with open(Logger.BATTERY_FILE, "a") as f:
                f.write(json.dumps(entry, separators=(",", ":")) + "\n")

            Logger._rotate_if_needed(Logger.BATTERY_FILE)

        except Exception as e:
            print("Battery log error:", e)

    @staticmethod
    def _log(level, module, event, context=None):
        """Core logging method."""
        if not Logger._should_log(level):
            return

        try:
            now = Logger._now()
            entry = Logger._build_entry(level, module, event, context)

            # Optional console output
            if Logger.ENABLE_CONSOLE:
                print(json.dumps(entry))

            # Detect long gap between logs
            long_gap = (
                Logger.LAST_LOG_TIME != 0
                and (now - Logger.LAST_LOG_TIME) >= Logger.LONG_INTERVAL_THRESHOLD
            )
            Logger.LAST_LOG_TIME = now

            # Force flush on long gap or critical logs
            if long_gap or level in ("ERROR", "FATAL"):
                Logger.BUFFER.append(entry)
                Logger._flush()
                return

            # Normal buffering
            Logger.BUFFER.append(entry)

            if (
                len(Logger.BUFFER) >= Logger.BUFFER_LIMIT
                or now - Logger.LAST_FLUSH >= Logger.FLUSH_INTERVAL
            ):
                Logger._flush()

        except Exception as e:
            print("Logger error:", e)

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