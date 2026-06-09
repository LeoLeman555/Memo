import time
from ble import BleService
from audio import AudioPlayer
from storage import Storage
from rtc import TimeRead
from scheduler import MemoScheduler
from logger import Logger
from battery import Battery

MODULE = "BOOT"
HEARTBEAT_INTERVAL = 300


def main():
    """Main firmware entry point."""
    Logger.info(
        MODULE,
        "FIRMWARE_BOOT",
    )

    storage = Storage()
    Logger.info(
        MODULE,
        "STORAGE_READY",
        {
            "backend": storage.get_backend()
        }
    )

    try:
        audio = AudioPlayer()
    except Exception as e:
        Logger.error(
            MODULE,
            "AUDIO_INIT_FAILED",
            {
                "error": str(e)
            }
        )
        audio = None

    ble = BleService(storage)
    try:
        rtc = TimeRead()
        rtc_available = True
    except Exception as e:
        Logger.warn(
            MODULE,
            "RTC_INIT_FAILED",
            {
                "error": str(e)
            }
        )
        rtc = None
        rtc_available = False

    scheduler = MemoScheduler(rtc, storage, audio) if rtc else None
    
    battery = Battery(samples=30, calibration=1.0)

    Logger.info(
        MODULE,
        "SERVICES_STARTED",
        {
            "ble": True,
            "rtc": rtc_available,
            "scheduler": scheduler is not None,
            "audio": audio is not None,
            "battery": battery.read() is not None
        }
    )

    Logger.info(
        MODULE,
        "FIRMWARE_READY"
    )

    last_heartbeat = time.time()

    while True:
        # Run scheduler only if RTC available
        if scheduler:
            scheduler.tick()

        # Process START frames
        if ble.has_pending_start():
            try:
                ble.process_start()
            except Exception as e:
                Logger.error(
                    MODULE,
                    "START_PROCESS_FAILED",
                    {
                        "error": str(e)
                    }
                )
        if ble.has_pending_chunk():
            try:
                ble.process_chunk()
            except Exception as e:
                Logger.error(
                    MODULE,
                    "CHUNK_PROCESS_FAILED",
                    {
                        "error": str(e)
                    }
                )
        # Finalize BLE file when requested
        if ble.end_requested:
            ble.end_requested = False
            try:
                ble.finalize_file()
                scheduler.reload()
                Logger.info(
                    MODULE,
                    "MEMOS_RELOADED_AFTER_SYNC"
                )
            except Exception as e:
                Logger.error(
                    MODULE,
                    "BLE_FINALIZE_FAILED",
                    {
                        "error": str(e)
                    }
                )

        # Heartbeat every 5 minutes
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            data = battery.read()
            Logger.log_battery(data)
            rtc_state = "unavailable"
            rtc_time = None
            storage_stats = storage.get_storage_stats()
            storage_stats["backend"] = storage.get_backend()
            if rtc:
                try:
                    rtc_time = rtc.get_datetime()
                    rtc_state = "ok" if rtc_time else "invalid"
                except Exception as e:
                    rtc_state = "error"
                    Logger.warn(
                        MODULE,
                        "RTC_READ_FAILED",
                        {
                            "error": str(e)
                        }
                    )
            Logger.info(
                MODULE,
                "SYSTEM_HEARTBEAT",
                {
                    "storage": storage_stats,
                    "rtc": {
                        "state": rtc_state,
                        "time": rtc_time
                    },
                    "bleConnected": ble.conn_handle is not None,
                    "audioAvailable": audio.available if audio else False,
                    "memosLoaded": len(scheduler.memos) if scheduler else 0,
                    "battery": {
                        "percent": data["percent"],
                        "voltage": data["voltage"],
                    }
                }
            )
            last_heartbeat = now

        time.sleep(0.05)

if __name__ == "__main__":
    main()