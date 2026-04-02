# Memo

This project is developed within the Make:able Challenge, which focuses on designing and building assistive technologies that improve daily life and autonomy for people with disabilities, using a user-centered and ethical design approach.

This application allows a responsible adult to configure scheduled voice reminders and send them to an autonomous ESP32-based device designed to support time awareness and daily routines for people with cognitive disabilities.

## Overview

The application enables:

- Text-based message creation
- Offline text-to-speech (TTS) generation into MP3 files
- Reliable Bluetooth Low Energy (BLE) transfer to an ESP32 device
- Scheduling and persistence of voice reminders
- Clear device status feedback for configuration and debugging

The system is designed to work fully offline, without cloud services, ensuring privacy and reliability.

## Technology Stack

- **React Native** (no Expo)
- **Android Native Module** (TextToSpeech → MP3)
- **Bluetooth Low Energy**: `react-native-ble-plx`

## Prerequisites

- Git ≥ 2.30
- Node.js ≥ 18
- npm
- Android Studio with Android SDK
- Physical Android device (required for BLE testing)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/LeoLeman555/Memo.git
cd Memo/
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the application (Android)

```bash
npx react-native run-android
```

## Project Structure

```text
src/
 ├─ components/      # Reusable UI components
 ├─ screens/         # Application screens
 ├─ services/        # BLE, TTS, mocks
 ├─ utils/           # Shared utilities and helpers
android/             # Native Android code (TTS module)
App.tsx
```

## Contributing

Contributions are welcome, provided the following rules are strictly respected.
If you like the project, consider giving it a ⭐️ on GitHub — it really helps!

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

- No cloud services
- No user accounts
- No analytics
- No personal data stored outside

This design complies with privacy-by-design principles and is suitable for vulnerable users.

## Contact

For any questions or feedback, feel free to contact me:

- GitHub: [LeoLeman555](https://github.com/LeoLeman555)
- Email: <leo.leman555@gmail.com>
