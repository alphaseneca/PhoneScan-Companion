# PhoneScan Companion — Developer Guide

This guide explains how PhoneScan Companion and `@alphaseneca/react-native-phonescan` work, from USB bytes to UI and firmware programming.

---

## 1. Problem the software solves

PhoneScan is a USB composite device. The useful channel for high-speed barcodes and configuration is **CDC-ACM** (a virtual serial port). HID keyboard output exists in the hardware spec but is too slow for dense scan streams, so this stack ignores HID.

Firmware updates use a second USB identity: after the device receives `bootloader`, it reboots into the **CH55x ISP bootloader** for a few seconds. The host must claim that device, program flash, and let it reset back to PhoneScan.

| Role | VID | PID | Notes |
|------|-----|-----|--------|
| Application (PhoneScan) | `0x1209` | `0xC55C` | CDC at 57600 baud (soft) |
| Bootloader (CH55x ISP) | `0x4348` | `0x55E0` | Vendor class `0xFF`; ~5s window |

Official electrical / protocol notes: [`devdocs.pdf`](./devdocs.pdf).

---

## 2. System architecture

```
Companion UI (React Native)
  └─ usePhoneScanScanner / settings
       └─ createPhoneScanClient()  (@alphaseneca/react-native-phonescan)
            ├─ UsbSerialRepository  → UsbSerialModule (Kotlin CDC)
            └─ FirmwareFlashRepository → FirmwareFlashModule + Ch55xBootloaderProgrammer
```

**Rules of thumb**

- Presentation never calls `NativeModules` directly.
- Hardware I/O lives in the library; Companion owns branding, layout, and preference persistence.
- New firmware capabilities should appear as additive use cases / `@ReactMethod`s, not by breaking existing call sites.

### Layout

```
packages/react-native-phonescan/
  src/                 TypeScript API, domain, hook
  android/             UsbSerialModule, FirmwareFlashModule, CH55x programmer
src/
  presentation/        Companion UI
  settings/            Auto-connect and future preference stubs
  assets/              Logo
  core/di/             App wires createPhoneScanClient()
android/app/           Host application, USB filter, CompanionPreferences
docs/
.github/workflows/release-apk.yml
```

---

## 3. CDC protocol (application mode)

Commands are ASCII lines terminated with `\r\n`.

| Command | Meaning |
|---------|---------|
| `manual` / `sense` / `continuous` / `next` | Scan mode |
| `mode` / `status` | Query |
| `trig` / `sleep` / `wake` | Trigger / power |
| `bootloader` | Leave CDC and enter ISP |
| `help` | List commands |

Typical decode stream:

```text
[ scan ]
ABC123
```

Native line handling:

1. Line is / contains `[ scan ]` → emit `UsbSerial:onScanSignal` only.
2. Next non-control line → emit `UsbSerial:onScan` with the barcode (hot path).
3. Control / status / error lines → `UsbSerial:onSerialLine` only.

Barcode payloads must not also emit `onSerialLine` (that doubles bridge traffic).

Status blocks are parsed in JS by `parsePhoneScanStatus()`.

---

## 4. Firmware update (bootloader mode)

ISP framing is adapted from the CH55xduino WebUSB tool [`ch55xbl.js`](https://github.com/DeqingSun/ch55xduino/blob/ch55xduino/bootloaderWebtool/ch55xbl.js).

### End-to-end flow

1. User picks a `.bin` or Intel `.hex` file (`pickFirmwareFile`).
2. Host sends `bootloader\r\n` over CDC and releases the serial session.
3. Device re-enumerates as `0x4348` / `0x55E0` (poll ≤ `BOOTLOADER_WAIT_TIMEOUT_MS`, default 5s).
4. Host requests USB permission, claims the vendor interface, then: detect → init → erase → write → verify → reset.
5. Device returns as PhoneScan; the UI refreshes the device list.

Write packets use the CH55x XOR mask and 56-byte payload chunks defined by that bootloader protocol.

### Library surface

```ts
const file = await client.pickFirmwareFile.execute();
await client.flashFirmware.execute({
  firmwareBase64: file.base64,
  enterBootloader: true,
  waitTimeoutMs: 5000,
});
client.firmwareFlashRepository.onProgress(p => { /* phase, current, total, message */ });
```

| Edge case | Expected behavior |
|-----------|-------------------|
| USB detach right after `bootloader` | Normal; flash UI must not treat it as a fatal scan error |
| Bootloader never appears | Timeout error; user retries with cable seated |
| Permission denied on BL device | Clear error; flash can be retried |
| Verify mismatch | Fail the operation; do not report success |

---

## 5. UsbSerialModule (CDC bridge)

Dependency: `com.github.mik3y:usb-serial-for-android:3.9.0` (JitPack).

| Method | Role |
|--------|------|
| `listDevices` | CDC-capable devices; flags PhoneScan VID/PID |
| `requestPermission` | Android USB permission |
| `connect` / `disconnect` | Open / close port |
| `sendCommand` | Append `\r\n` and write |

| Event | Payload intent |
|-------|----------------|
| `UsbSerial:onScan` | Complete barcode |
| `UsbSerial:onScanSignal` | Saw `[ scan ]` |
| `UsbSerial:onSerialLine` | Control / status text |
| `UsbSerial:onConnectionState` | Connected flag |
| `UsbSerial:onError` | Detach / IO failures |

Resilience details: generation counters for connect races, detach receiver, permission timeout, IO on a dedicated thread, soft handling of unsupported DTR/RTS.

Host `AndroidManifest` must declare USB host and a device filter that includes PhoneScan and the bootloader VID/PID.

---

## 6. TypeScript client and UI hook

`createPhoneScanClient()` wires repositories and use cases once.

| Use case | Responsibility |
|----------|----------------|
| `ListUsbDevicesUseCase` | Enumerate |
| `ConnectScannerUseCase` | Permission + open |
| `DisconnectScannerUseCase` | Close |
| `SendPhoneScanCommandUseCase` | Send command string |
| `PickFirmwareFileUseCase` | Document picker |
| `FlashFirmwareUseCase` | Bootloader entry + ISP |

`usePhoneScanScanner(client, { autoConnect })` owns presentation state: device list, latest scan, history, flash progress, and optional auto-connect polling while idle.

Scan UI latency rules:

1. Update `latestScan` synchronously on every `onScan`.
2. Flush history on the next animation frame.
3. Throughput metrics use a sliding 1-second window.

Companion settings (`src/settings`) persist preferences such as `autoConnect` via a small SharedPreferences module in the host app. New toggles should extend `CompanionSettings` with defaults.

---

## 7. Build and release

### Development

```powershell
npm install
npm start
npm run android
```

### Release APK

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
$env:GRADLE_USER_HOME="C:\gradle"
cd android
.\gradlew.bat assembleRelease
```

### CI

[`.github/workflows/release-apk.yml`](../.github/workflows/release-apk.yml) builds the Android release APK and publishes `@alphaseneca/react-native-phonescan` when a version tag is pushed.

### Component registration

`app.json` `name` and `MainActivity.getMainComponentName()` must match (currently `PhoneScanCompanion`). A mismatch crashes at launch with “has not been registered”.

---

## 8. Platforms

| Platform | CDC | Firmware flash |
|----------|-----|----------------|
| Android (USB OTG) | Supported | Supported |
| iOS | Stub only | Stub only |

---

## 9. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty device list | No OTG path, wrong filter, need Refresh |
| Bootloader timeout | Missed the ~5s window or unstable cable |
| Permission denied | User dismissed USB dialog (app or bootloader) |
| Flash verify failed | Wrong image or interrupted transfer |
| UI feels laggy under load | Logging every scan line; keep barcode on `onScan` only |
