# @alphaseneca/react-native-phonescan

React Native library (Android) for **PhoneScan** USB devices:

- High-speed **CDC serial** scan capture and control commands
- **CH55x ISP** firmware programming after the device enters bootloader mode

| Mode | VID | PID |
|------|-----|-----|
| PhoneScan (CDC) | `0x1209` | `0xC55C` |
| CH55x bootloader | `0x4348` | `0x55E0` |

Default CDC baud: **57600**. Line ending for commands: `\r\n`.

## Install

```bash
npm install @alphaseneca/react-native-phonescan
npm install @alphaseneca/react-native-phonescan@1.0.0
npm install @alphaseneca/react-native-phonescan@^1.0.0
```

Local checkout:

```bash
npm install file:./packages/react-native-phonescan
```

Rebuild the Android app after install so autolinking registers native modules.

The API follows semver. New firmware features are additive (new exports, use cases, and `@ReactMethod`s). Known commands live in `PHONESCAN_COMMANDS`; unknown firmware strings can still be sent through `sendCommand`.

## Host app Android setup

1. USB host + attach intent on the launcher activity.
2. A USB device filter that includes PhoneScan **and** the bootloader IDs (see `android/src/main/res/xml/phonescan_usb_device_filter.xml` in this package).
3. Autolinking provides `PhoneScanPackage` (`UsbSerialModule` + `FirmwareFlashModule`).

## Quick start

```tsx
import {
  createPhoneScanClient,
  usePhoneScanScanner,
} from '@alphaseneca/react-native-phonescan';

const client = createPhoneScanClient();

function Scanner() {
  const state = usePhoneScanScanner(client, {autoConnect: true});
  // state.latestScan, state.connect, state.pickFirmware, state.flashFirmware, …
}
```

## CDC

| Piece | Role |
|-------|------|
| `createPhoneScanClient()` | Repositories + use cases |
| `usePhoneScanScanner(client, options?)` | UI-oriented state machine |
| `PHONESCAN_COMMANDS` | Known ASCII commands |
| `isPhoneScanDevice(vid, pid)` | Hardware match |

Events (via repository): `onScan`, `onScanSignal`, `onSerialLine`, `onConnectionState`, `onError`, `onDevicesChanged`.

## Firmware

```tsx
const file = await client.pickFirmwareFile.execute(); // .bin or .hex
if (file) {
  await client.flashFirmware.execute({
    firmwareBase64: file.base64,
    enterBootloader: true,
    waitTimeoutMs: 5000,
  });
}
```

ISP sequence (detect → erase → write → verify → reset) follows the CH55xduino WebUSB programmer [`ch55xbl.js`](https://github.com/DeqingSun/ch55xduino/blob/ch55xduino/bootloaderWebtool/ch55xbl.js).

Progress: `client.firmwareFlashRepository.onProgress(...)`.

## Platforms

| Platform | CDC | Flash |
|----------|-----|-------|
| Android OTG | Yes | Yes |
| iOS | Stub | Stub |

## License

Same as the PhoneScan Companion repository.
