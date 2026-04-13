import time
from ble import BleService
from audio import AudioPlayer
from storage import Storage
from rtc import TimeRead
from scheduler import MemoScheduler
from logger import Logger
from battery import Battery

MODULE = "BOOT"
HEARTBEAT_INTERVAL = 180
BATTERY_INTERVAL = 300


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
    data = battery.read()

    Logger.info(
        MODULE,
        "SERVICES_STARTED",
        {
            "ble": True,
            "rtc": rtc_available,
            "scheduler": scheduler is not None,
            "audio": audio is not None,
            "battery": {
                "voltage": round(data["voltage"], 3),
                "state": data["state"],
                "percent": round(data["percent"], 1),
                "consumption_vph": round(data["consumption_v_per_h"], 4),
            }
        }
    )

    Logger.info(
        MODULE,
        "FIRMWARE_READY"
    )

    last_heartbeat = time.time()
    last_battery = time.time()

    while True:
        # Run scheduler only if RTC available
        if scheduler:
            scheduler.tick()

        # Flush BLE chunk queue (NO SD access in IRQ anymore)
        if hasattr(ble, "has_pending_chunk") and ble.has_pending_chunk():
            chunk = ble.pop_chunk()
            if chunk:
                try:
                    storage.append_chunk(chunk)
                except Exception as e:
                    Logger.error(
                        MODULE,
                        "SD_WRITE_FAILED",
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
            Logger.info(
                MODULE,
                "SYSTEM_HEARTBEAT",
                {
                    "storage": storage.get_backend(),
                    "bleConnected": ble.conn_handle is not None,
                    "audioAvailable": audio.available if audio else False,
                    "memosLoaded": len(scheduler.memos) if scheduler else 0,
                    "battery": {
                        "voltage": round(data["voltage"], 3),
                        "percent": round(data["percent"], 1),
                        "consumption_vph": round(data["consumption_v_per_h"], 4),
                        "state": data["state"]
                    }
                }
            )
            last_heartbeat = now

        if now - last_battery >= BATTERY_INTERVAL:
            data = battery.read()
            Logger.log_battery(data)
            Logger.info(
                "BATTERY",
                "BATTERY_STATUS",
                {
                    "voltage": round(data["voltage"], 3),
                    "percent": round(data["percent"], 1),
                    "state": data["state"],
                    "consumption_vph": round(data["consumption_v_per_h"], 4),
                    "raw": round(data["raw"], 1),
                    "time": data["time"],
                    "dt": data["dt"],
                    "dv": data["dv"]
                }
            )
            last_battery = now

        time.sleep(0.05)

if __name__ == "__main__":
    main()