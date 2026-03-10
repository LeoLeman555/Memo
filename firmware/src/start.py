import time
from ble import BleService
from audio import AudioPlayer
from storage import Storage
from rtc import TimeRead
from scheduler import MemoScheduler


def main():
    """Main firmware entry point."""
    print("[START] Talking Box firmware booting")

    storage = Storage()

    try:
        audio = AudioPlayer()
    except Exception as e:
        print("[START] Audio disabled:", e)
        audio = None

    ble = BleService(storage)
    rtc = TimeRead()
    scheduler = MemoScheduler(rtc, storage, audio)

    print("[START] Ready")

    while True:
        # Run scheduler
        scheduler.tick()

        # Flush BLE chunk queue (NO SD access in IRQ anymore)
        if hasattr(ble, "has_pending_chunk") and ble.has_pending_chunk():
            chunk = ble.pop_chunk()
            if chunk:
                try:
                    storage.append_chunk(chunk)
                except Exception as e:
                    print("[START] SD write error:", e)

        # Finalize BLE file when requested
        if ble.end_requested:
            ble.end_requested = False
            try:
                ble.finalize_file()
                scheduler.reload()
                print("[START] Memos reloaded after BLE sync")
            except Exception as e:
                print("[START] Finalize failed:", e)

        time.sleep(0.05)

if __name__ == "__main__":
    main()