# Memo

MEMO is a fully offline assistive voice reminder system developed as part of the Make:able Challenge, an international engineering competition focused on creating practical technologies that improve autonomy for people with disabilities through user-centered design.

The system was designed for a real user with cognitive and temporal orientation difficulties, requiring a simple, reliable and autonomous way to receive spoken reminders during the day without depending on direct smartphone interaction.

MEMO is composed of two connected subsystems:

- **MEMO Controller** — an Android mobile application used by a caregiver to create, schedule and synchronize reminders
- **MEMO Device** — an ESP32-based autonomous embedded box responsible for storing and playing spoken reminders at the correct time

A complete presentation of the MEMO project, including system overview, technical details, architecture explanations and demonstrations, is available on the official [MEMO Project Website](https://leoleman555.github.io/Memo/)

The complete system works entirely offline, without Wi-Fi, cloud services or external servers.

## Overview

The MEMO workflow follows a deterministic local pipeline:

1. The caregiver creates a reminder in the mobile application
2. Reminder data is validated locally
3. The message is converted into a local WAV audio file using offline Android Text-to-Speech
4. Reminder metadata and audio are prepared for synchronization
5. Files are transferred to the ESP32 through a custom Bluetooth Low Energy protocol
6. The embedded firmware stores, verifies and schedules the reminder
7. The MEMO device executes the spoken notification autonomously at the programmed time

This architecture allows the mobile phone to act only as a configuration tool, while the MEMO device remains fully independent during daily use.

## Core Features

- Scheduled spoken reminder creation
- Daily, weekly and monthly recurrence support
- Offline Android Text-to-Speech audio generation
- Deterministic local WAV file management
- Bluetooth Low Energy synchronization with ESP32
- Embedded persistent reminder storage
- Autonomous time-based execution using hardware RTC
- Real-time transfer and device status feedback
- Fully local privacy-preserving architecture

## Global Architecture

### MEMO Controller — Mobile Application

The Android application is developed in React Native and provides:

- reminder creation and edition screens
- validation of temporal and recurrence rules
- native offline Text-to-Speech generation
- Bluetooth synchronization management
- synchronization status monitoring

### MEMO Device — Embedded Firmware

The embedded device runs a MicroPython firmware on ESP32 and provides:

- BLE GATT server communication
- chunked file reception and reconstruction
- SHA-256 integrity verification
- persistent storage on SD card / internal flash
- RTC-based scheduling logic
- autonomous WAV audio playback

Detailed embedded firmware documentation is available in [`firmware/README.md`](./firmware/README.md).

## Technology Stack

### Mobile Application

- **React Native 0.82**
- **TypeScript**
- **Android Native TextToSpeech Module**
- **react-native-ble-plx**

### Embedded System

- **ESP32**
- **MicroPython v1.27**
- **Bluetooth Low Energy GATT**
- **DS3231 RTC**
- **I2S WAV Audio Output**
- **MicroSD persistent storage**

## Prerequisites

### Mobile development

- Git ≥ 2.30
- Node.js ≥ 22
- npm
- Android Studio with Android SDK
- Physical Android device for BLE testing

### Embedded development

- Python ≥ 3.12
- `mpremote`
- ESP32 board flashed with MicroPython

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/LeoLeman555/Memo.git
cd Memo/
```

### 2. Install mobile dependencies

```bash
npm install
```

### 3. Run the application (Android)

```bash
npx react-native run-android
```

### 4. Deploy firmware to ESP32

```powershell
.\tools\deploy.ps1
```

## Project Structure

```text
MEMO/
├── README.md
├── firmware/
│   ├── README.md
│   └── src/
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   ├── domain/
│   ├── hooks/
│   └── utils/
├── android/
├── tools/deploy.ps1
└── App.tsx
```

## Contributing

Contributions are welcome, but all changes must preserve the architectural consistency and reliability requirements of the MEMO system.

### 1. Fork the repository

If you do not have write access to the repository:

1. Click **Fork** on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/<repository-name>.git
cd <repository-name>
```

### 2. Create a new branch

Always create a dedicated branch for your change and never work directly on main.

```bash
git checkout -b type/<scope>-short-description
```

Examples:

```bash
git checkout -b feat/ui-reminder-editor
git checkout -b fix/ble-transfer-timeout
git checkout -b refactor/tts-native-module
```

### 3. Make your changes

- Implement your feature or fix
- Test the application locally
- Ensure the app starts and runs without crashes
- Please if possible, test on a real Android device

Check modified files:

```bash
git status
```

### 4. Commit your changes

This project strictly follows Conventional Commits.

Format:

```bash
git commit -m "type(scope): short description"
```

Examples:

```bash
git commit -m "feat(ui): add reminder editor screen"
git commit -m "fix(ble): prevent crash after file transfer"
git commit -m "refactor(tts): isolate android native module"
```

Rules:

- One logical change per commit
- Description must be clear and concise

### 5. Push your branch

Push your branch to GitHub:

```bash
git push origin type/<scope>-short-description
```

### 6. Open a Pull Request

On GitHub:

1. Open a Pull Request from your branch to main
2. Fill in the description with:
   - What was changed
   - Why it was changed
   - How it was tested

## Privacy

MEMO was intentionally designed as a fully local assistive system:

- No cloud infrastructure
- No user account system
- No analytics collection
- No third-party reminder storage
- No personal data transmitted outside the local device pair

This offline-first architecture guarantees predictable behavior, data confidentiality and operational independence for vulnerable users.

## Contact

For any questions or feedback, feel free to contact me:

- GitHub: [LeoLeman555](https://github.com/LeoLeman555)
- Email: <leo.leman555@gmail.com>
