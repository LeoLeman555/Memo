# MEMO Device Firmware

MicroPython firmware running on the ESP32 embedded device of the MEMO system.

This firmware is responsible for:

- Receiving reminder files over Bluetooth Low Energy (BLE)
- Reconstructing transferred WAV audio and JSON metadata
- Verifying file integrity through SHA-256 validation
- Storing reminders on SD card or internal flash memory
- Managing RTC-based alarms and recurrence logic
- Playing scheduled audio notifications through the embedded audio subsystem

It is designed to work in conjunction with the MEMO Controller Android application and to execute reminders autonomously once synchronization is complete.

## Responsibilities

- BLE command handling (START, CHUNK, END)
- Chunked file reception and sequence validation
- SHA-256 integrity verification
- Persistent storage of audio files and reminder metadata
- DS3231 RTC time management
- Autonomous scheduler execution
- WAV audio playback
- Internal logging and runtime supervision

## Project Structure

```text
firmware/
├── src/
│ ├── start.py       # Global initialization and main loop
│ ├── ble.py         # BLE protocol and transfer state machine
│ ├── rtc.py         # DS3231 real-time clock management
│ ├── scheduler.py   # Reminder planning and recurrence logic
│ ├── storage.py     # Persistent file and JSON storage
│ ├── sdcard.py      # MicroSD low-level driver
│ ├── audio.py       # Embedded WAV playback control
│ ├── logger.py      # Internal logging system
└── README.md
```

### File roles

- **start.py**  
  Initializes all embedded services and runs the deterministic main runtime loop.

- **ble.py**  
  Implements the custom BLE protocol used by MEMO Controller:

  - START transfer initialization
  - CHUNK sequential data reception
  - END transfer finalization
  - Status notifications
  - Sequence and integrity validation

- **rtc.py**  
  Handles the DS3231 hardware clock:

  - RTC initialization
  - Safe date and time reading
  - Persistent temporal reference

- **scheduler.py**  
  Manages autonomous reminder execution:

  - One-shot reminders
  - Daily recurrence
  - Weekly recurrence
  - Monthly recurrence
  - Time comparison and trigger decisions

- **storage.py**  
  Handles:

  - WAV file writing and reading
  - JSON reminder metadata persistence
  - Temporary transfer files
  - SHA-256 verification
  - Atomic file finalization

- **sdcard.py**  
  Provides low-level MicroSD access used as the main storage backend.

- **audio.py**  
  Controls local embedded audio playback:

  - WAV buffered streaming
  - Play / Pause / Resume / Stop
  - Runtime playback state supervision

- **logger.py**  
  Provides structured internal logs for:

  - Transfer monitoring
  - Scheduler events
  - Peripheral errors
  - Debugging

## Requirements

- ESP32 flashed with MicroPython **v1.27**
- DS3231 RTC module
- MicroSD card module
- Embedded I2S audio output
- `mpremote` installed on the host machine

## Deployment to ESP32

### Manual deployment (reference)

Files must be copied explicitly to the ESP32 filesystem.

```bash
mpremote cp firmware/src/start.py :start.py
mpremote cp firmware/src/ble.py :ble.py
mpremote cp firmware/src/rtc.py :rtc.py
mpremote cp firmware/src/scheduler.py :scheduler.py
mpremote cp firmware/src/storage.py :storage.py
mpremote cp firmware/src/sdcard.py :sdcard.py
mpremote cp firmware/src/audio.py :audio.py
mpremote cp firmware/src/logger.py :logger.py
```

After deployment, reset the board:

```bash
mpremote reset
```

### Windows (recommended)

Firmware deployment is handled via a dedicated PowerShell script. From the project root:

```powershell
.\tools\deploy.ps1
```

The deployment script performs the following actions:

- Verifies tool availability (mpremote)
- Validates firmware source files
- Detects the connected ESP32 board
- Tests serial communication
- Uploads the required firmware files
- Resets the board after deployment
- Optionally synchronizes the RTC

Refer to the main project README for complete system architecture and mobile integration details.
