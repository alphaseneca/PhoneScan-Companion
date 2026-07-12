# PhoneScan Companion

Android companion app for the **PhoneScan** USB barcode scanner.

PhoneScan presents a CDC virtual serial port for scan data and device control, and a short CH55x ISP bootloader window for firmware updates. This repository contains:

1. **PhoneScan Companion** — the React Native Android app end users install.
2. **`@alphaseneca/react-native-phonescan`** — the reusable library other apps can depend on for the same USB CDC and flash behavior.

Hardware identity:

| Field | Value |
|-------|-------|
| Product | PhoneScan |
| VID / PID | `0x1209` / `0xC55C` |
| Recommended baud | 57600 |
| Bootloader VID / PID | `0x4348` / `0x55E0` |

Hardware protocol reference: [`docs/devdocs.pdf`](docs/devdocs.pdf).  
Engineering reference: [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).

## What the companion app does

- Lists USB CDC devices and connects to PhoneScan over OTG.
- Shows live barcode payloads from the CDC stream (not HID keyboard).
- Sends control commands (`status`, scan modes, `trig`, `bootloader`, …).
- Updates firmware from a `.bin` or Intel `.hex` file through the CH55x bootloader.
- Optional **auto-connect** when a device appears (Settings).

## Requirements

- Node.js 22+
- JDK 17–21
- Android SDK (API 24+)
- Physical Android phone/tablet with **USB OTG**
- PhoneScan hardware

## Run from source

```bash
npm install
npm run android
```

1. Enable USB debugging on the phone.
2. Connect PhoneScan with an OTG cable.
3. Open **PhoneScan Companion**, grant USB permission, connect (or enable auto-connect).
4. Scan barcodes, or use **Firmware** to select a `.bin` / `.hex` and update.

## Build a release APK

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:GRADLE_USER_HOME = "C:\gradle"
cd android
.\gradlew.bat assembleRelease
```

APK path: `android/app/build/outputs/apk/release/app-release.apk`

Local builds use the React Native debug keystore. Production distribution needs your own signing configuration; do not commit keystores or passwords.

## Use the library in another app

```bash
npm install @alphaseneca/react-native-phonescan
npm install @alphaseneca/react-native-phonescan@1.0.0
npm install @alphaseneca/react-native-phonescan@^1.0.0
```

This demo app links the package locally with `file:./packages/react-native-phonescan`.

Integration details: [`packages/react-native-phonescan/README.md`](packages/react-native-phonescan/README.md).

## Repository layout

```
packages/react-native-phonescan/   # Library: CDC + CH55x flash (JS + Kotlin)
src/presentation/                  # Companion screens and components
src/settings/                      # App preferences (auto-connect and future toggles)
src/assets/                        # Branding
docs/                              # Developer guide and hardware PDF
.github/workflows/                 # Release automation
android/                           # Companion Android host project
```

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| No devices listed | OTG cable, device power, USB filter VID/PID, Refresh |
| Permission denied | Accept the system USB permission dialog |
| Bootloader timeout | Keep the cable seated; start flash within ~5s of reboot |
| Verify failed | Correct firmware image; retry a full flash |
| App blank / crash on open | Component name in `MainActivity` must match `app.json` `name` |
