# audio.py
from machine import I2S, Pin
import time
import _thread
from logger import Logger

MODULE = "AUDIO"


class AudioPlayer:
    """WAV audio player using I2S with safe fallback."""

    def __init__(
        self,
        sck_pin=26,
        ws_pin=25,
        sd_pin=27,
        rate=20000,
        ibuf=8000,
    ):
        self._playing = False
        self._paused = False
        self._lock = _thread.allocate_lock()
        self.available = False
        self.audio = None

        try:
            self.audio = I2S(
                0,
                sck=Pin(sck_pin),
                ws=Pin(ws_pin),
                sd=Pin(sd_pin),
                mode=I2S.TX,
                bits=16,
                format=I2S.MONO,
                rate=rate,
                ibuf=ibuf,
            )
            self.available = True
            Logger.info(
                MODULE,
                "I2S_INITIALIZED",
                {
                    "sckPin": sck_pin,
                    "wsPin": ws_pin,
                    "sdPin": sd_pin,
                    "sampleRate": rate,
                    "bufferSize": ibuf
                }
            )

        except Exception as e:
            self.available = False
            self.audio = None
            Logger.error(
                MODULE,
                "I2S_INIT_FAILED",
                {
                    "sckPin": sck_pin,
                    "wsPin": ws_pin,
                    "sdPin": sd_pin,
                    "sampleRate": rate,
                    "bufferSize": ibuf,
                    "error": str(e)
                }
            )

    def play_wav(self, filename: str):
        """Play a WAV file if audio is available."""
        if not self.available:
            Logger.warn(
                MODULE,
                "PLAY_REQUEST_IGNORED",
                {"reason": "audio_disabled"}
            )
            return

        with self._lock:
            if self._playing:
                return
            self._playing = True
            self._paused = False

        try:
            Logger.info(
                MODULE,
                "PLAYBACK_STARTED",
                {"filename": filename}
            )
            with open(filename, "rb") as f:
                f.seek(44)  # Skip WAV header

                while True:
                    with self._lock:
                        if not self._playing:
                            break
                        paused = self._paused

                    if paused:
                        time.sleep_ms(20)
                        continue

                    data = f.read(1024)
                    if not data:
                        break

                    try:
                        self.audio.write(data)
                    except Exception as e:
                        Logger.error(
                            MODULE,
                            "I2S_WRITE_FAILED",
                            {
                                "filename": filename,
                                "error": str(e)
                            }
                        )
                        break

        except OSError as e:
            Logger.error(
                MODULE,
                "AUDIO_FILE_ERROR",
                {
                    "filename": filename,
                    "error": str(e)
                }
            )

        except Exception as e:
            Logger.error(
                MODULE,
                "PLAYBACK_ERROR",
                {
                    "filename": filename,
                    "error": str(e)
                }
            )

        finally:
            with self._lock:
                self._playing = False
                self._paused = False

            Logger.info(
                MODULE,
                "PLAYBACK_FINISHED",
                {"filename": filename}
            )

    def pause(self):
        """Pause playback."""
        if not self.available:
            return
        with self._lock:
            if self._playing:
                Logger.debug(
                    MODULE,
                    "PLAYBACK_PAUSED"
                )
                self._paused = True

    def resume(self):
        """Resume playback."""
        if not self.available:
            return
        with self._lock:
            if self._playing:
                Logger.debug(
                    MODULE,
                    "PLAYBACK_RESUMED"
                )
                self._paused = False

    def stop(self):
        """Stop playback."""
        if not self.available:
            return
        with self._lock:
            Logger.info(
                MODULE,
                "PLAYBACK_STOPPED"
            )
            self._playing = False
            self._paused = False

    def is_playing(self):
        """Return True if playing."""
        with self._lock:
            return self._playing if self.available else False

    def is_paused(self):
        """Return True if paused."""
        with self._lock:
            return self._paused if self.available else False
