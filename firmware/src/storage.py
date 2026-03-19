from machine import SPI, Pin
import os
import sdcard
import uhashlib
import ubinascii
import ujson
from logger import Logger

MODULE = "STORAGE"


class Storage:
    """Persistent storage handler with SD fallback to flash."""

    SD_ROOT = "/sd"
    FLASH_ROOT = "/flash"

    AUDIO_SUBDIR = "audio"
    DATA_SUBDIR = "data"

    TMP_PREFIX = ".tmp_"

    def __init__(self):
        self.use_sd = False
        self.root = self.FLASH_ROOT
        self._tmp_path = None

        self._ensure_flash_root()
        self._try_mount_sd()
        self._ensure_directories()
        self._cleanup_temp_files()

        Logger.info(
            MODULE,
            "STORAGE_INITIALIZED",
            {
                "backend": self.get_backend(),
                "root": self.root
            }
        )

    def _ensure_flash_root(self):
        """Ensure flash root exists."""
        try:
            os.stat(self.FLASH_ROOT)
        except OSError:
            os.mkdir(self.FLASH_ROOT)
            Logger.info(
                MODULE,
                "FLASH_ROOT_CREATED",
                {
                    "path": self.FLASH_ROOT
                }
            )

    def _try_mount_sd(self):
        """Attempt to mount SD card."""
        try:
            Logger.debug(
                MODULE,
                "SD_MOUNT_ATTEMPT"
            )
            spi = SPI(
                2,
                baudrate=10_000_000,
                polarity=0,
                phase=0,
                sck=Pin(18),
                mosi=Pin(23),
                miso=Pin(19),
            )

            sd = sdcard.SDCard(spi, Pin(13))  # CS = GPIO13
            os.mount(sd, self.SD_ROOT)
            Logger.info(
                MODULE,
                "SD_MOUNT_SUCCESS",
                {
                    "mountPoint": self.SD_ROOT
                }
            )

            self.use_sd = True
            self.root = self.SD_ROOT
            os.stat(self.SD_ROOT)

        except Exception:
            Logger.warn(
                MODULE,
                "SD_MOUNT_FAILED",
                {
                    "fallback": self.FLASH_ROOT
                }
            )
            self.use_sd = False
            self.root = self.FLASH_ROOT

    def _safe_open(self, path, mode):
        """Open file without backend mutation."""
        return open(path, mode)

    def _audio_dir(self):
        """Return audio directory path."""
        return "{}/{}".format(self.root, self.AUDIO_SUBDIR)

    def _data_dir(self):
        """Return data directory path."""
        return "{}/{}".format(self.root, self.DATA_SUBDIR)

    def get_audio_path(self, filename):
        """Return absolute audio file path."""
        return "{}/{}".format(self._audio_dir(), filename)

    def get_json_path(self, filename):
        """Return absolute JSON file path."""
        return "{}/{}".format(self._data_dir(), filename)

    def _ensure_directories(self):
        """Ensure required directories exist."""
        for path in (self._audio_dir(), self._data_dir()):
            try:
                Logger.debug(
                    MODULE,
                    "DIRECTORY_CREATED",
                    {
                        "path": path
                    }
                )
                os.stat(path)
            except OSError:
                os.mkdir(path)

    def save_file(self, filename, data):
        """Save full binary audio file."""
        path = self.get_audio_path(filename)
        with self._safe_open(path, "wb") as f:
            f.write(data)
            Logger.info(
                MODULE,
                "AUDIO_FILE_SAVED",
                {
                    "filename": filename,
                    "path": path,
                    "size": len(data)
                }
            )

    def start_temp_file(self, filename):
        """Create temp file for chunked transfer."""
        self._tmp_path = "{}/{}{}".format(
            self._audio_dir(), self.TMP_PREFIX, filename
        )
        Logger.info(
            MODULE,
            "TEMP_FILE_CREATED",
            {
                "filename": filename,
                "tempPath": self._tmp_path
            }
        )
        with self._safe_open(self._tmp_path, "wb"):
            pass

    def append_chunk(self, data):
        """Append binary chunk to temp file."""
        if not self._tmp_path:
            raise RuntimeError("No temp file started")
        with self._safe_open(self._tmp_path, "ab") as f:
            f.write(data)
            Logger.trace(
                MODULE,
                "CHUNK_WRITTEN",
                {
                    "size": len(data),
                    "tempPath": self._tmp_path
                }
            )

    def finalize_temp_file(self, filename):
        """Finalize temp file and route to audio or data directory."""
        if not self._tmp_path:
            raise RuntimeError("No temp file to finalize")

        # Compute SHA256
        h = uhashlib.sha256()
        with self._safe_open(self._tmp_path, "rb") as f:
            while True:
                chunk = f.read(1024)
                if not chunk:
                    break
                h.update(chunk)

        digest = ubinascii.hexlify(h.digest()).decode()

        # Route by extension
        if filename.endswith(".json"):
            # Read temp JSON
            with self._safe_open(self._tmp_path, "r") as f:
                data = ujson.load(f)

            # Write atomically to /data
            self.write_json(filename, data)

            # Remove temp file
            os.remove(self._tmp_path)

            final_path = self.get_json_path(filename)

        else:
            # Default: audio (wav)
            final_path = self._tmp_path.replace(self.TMP_PREFIX, "")
            os.rename(self._tmp_path, final_path)

        self._tmp_path = None
        Logger.info(
            MODULE,
            "FILE_FINALIZED",
            {
                "path": final_path,
                "sha256": digest
            }
        )
        return digest

    def audio_exists(self, filename):
        """Check if audio file exists."""
        try:
            os.stat(self.get_audio_path(filename))
            return True
        except OSError:
            return False

    def delete_audio(self, filename):
        """Delete audio file."""
        try:
            os.remove(self.get_audio_path(filename))
            Logger.info(
                MODULE,
                "AUDIO_FILE_DELETED",
                {
                    "filename": filename
                }
            )
            return True
        except OSError:
            return False

    def _write_pretty_json(self, f, obj, indent=0):
        """Write JSON with deterministic formatting."""
        space = "    "
        if isinstance(obj, dict):
            f.write("{\n")
            keys = list(obj.keys())
            for i, key in enumerate(keys):
                f.write(space * (indent + 1))
                f.write('"{}": '.format(key))
                self._write_pretty_json(f, obj[key], indent + 1)
                if i < len(keys) - 1:
                    f.write(",")
                f.write("\n")
            f.write(space * indent + "}")
        elif isinstance(obj, list):
            f.write("[\n")
            for i, item in enumerate(obj):
                f.write(space * (indent + 1))
                self._write_pretty_json(f, item, indent + 1)
                if i < len(obj) - 1:
                    f.write(",")
                f.write("\n")
            f.write(space * indent + "]")
        elif isinstance(obj, str):
            f.write('"{}"'.format(obj))
        elif obj is None:
            f.write("null")
        elif isinstance(obj, bool):
            f.write("true" if obj else "false")
        else:
            f.write(str(obj))

    def write_json(self, filename, data):
        """Write JSON atomically."""
        tmp = "{}/{}{}".format(self._data_dir(), self.TMP_PREFIX, filename)
        final = self.get_json_path(filename)

        with self._safe_open(tmp, "w") as f:
            self._write_pretty_json(f, data)
            f.write("\n")

        os.rename(tmp, final)
        Logger.info(
            MODULE,
            "JSON_WRITTEN",
            {
                "filename": filename,
                "path": final
            }
        )

    def read_json(self, filename):
        """Read JSON file."""
        with self._safe_open(self.get_json_path(filename), "r") as f:
            Logger.debug(
                MODULE,
                "JSON_READ",
                {
                    "filename": filename
                }
            )
            return ujson.load(f)

    def safe_read_json(self, filename, default=None):
        """Read JSON with fallback default."""
        try:
            return self.read_json(filename)
        except Exception:
            Logger.warn(
                MODULE,
                "JSON_READ_FAILED",
                {
                    "filename": filename
                }
            )
            return default

    def update_json(self, filename, update_fn):
        """Update JSON content."""
        data = self.safe_read_json(filename, {})
        update_fn(data)
        self.write_json(filename, data)

    def delete_json(self, filename):
        """Delete JSON file."""
        try:
            os.remove(self.get_json_path(filename))
            Logger.info(
                MODULE,
                "JSON_DELETED",
                {
                    "filename": filename
                }
            )
            return True
        except OSError:
            return False

    def _cleanup_temp_files(self):
        """Remove abandoned temp files."""
        for directory in (self._audio_dir(), self._data_dir()):
            try:
                for fname in os.listdir(directory):
                    if fname.startswith(self.TMP_PREFIX):
                        try:
                            os.remove("{}/{}".format(directory, fname))
                            Logger.warn(
                                MODULE,
                                "TEMP_FILE_REMOVED",
                                {
                                    "path": "{}/{}".format(directory, fname)
                                }
                            )
                        except OSError:
                            pass
            except OSError:
                pass

    def get_backend(self):
        """Return active backend name."""
        return "sd" if self.use_sd else "flash"
