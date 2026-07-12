/**
 * Public API for @alphaseneca/react-native-phonescan.
 *
 * Semver’d: new firmware features land as additive exports, use cases, and
 * native @ReactMethod entries — existing consumers keep working without changes.
 */

// Constants
export {
  PHONESCAN_VENDOR_ID,
  PHONESCAN_PRODUCT_ID,
  PHONESCAN_PRODUCT_NAME,
  CH55X_BOOTLOADER_VENDOR_ID,
  CH55X_BOOTLOADER_PRODUCT_ID,
  DEFAULT_BAUD_RATE,
  BAUD_RATE_OPTIONS,
  MAX_SCAN_HISTORY,
  PHONESCAN_SCAN_SIGNAL,
  BOOTLOADER_WAIT_TIMEOUT_MS,
  MAX_FIRMWARE_BYTES,
} from './constants';

// Client factory
export {
  createPhoneScanClient,
  defaultPhoneScanClient,
  type PhoneScanClient,
} from './createPhoneScanClient';

// Entities
export {
  PHONESCAN_COMMANDS,
  parsePhoneScanStatus,
  isPhoneScanDevice,
  type PhoneScanCommand,
  type PhoneScanScanMode,
  type PhoneScanStatus,
} from './domain/entities/PhoneScan';
export {createScanResult, type ScanResult} from './domain/entities/ScanResult';
export {
  USB_SERIAL_EVENTS,
  type UsbDeviceInfo,
  type SerialConnectionOptions,
  type ScanPayload,
  type SerialLinePayload,
  type ScanSignalPayload,
  type ConnectionStatePayload,
  type SerialErrorPayload,
  type DevicesChangedPayload,
  type Parity,
  type ScanSource,
} from './domain/entities/UsbSerialTypes';
export {
  FIRMWARE_FLASH_EVENTS,
  type FirmwareFormat,
  type FirmwareFilePayload,
  type BootloaderDeviceInfo,
  type FlashProgressPayload,
  type FlashFirmwareResult,
  type FlashFirmwareOptions,
} from './domain/entities/FirmwareTypes';

// Repository contract
export type {IUsbSerialRepository} from './domain/repositories/IUsbSerialRepository';

// Use cases
export {ConnectScannerUseCase} from './domain/usecases/ConnectScannerUseCase';
export {DisconnectScannerUseCase} from './domain/usecases/DisconnectScannerUseCase';
export {ListUsbDevicesUseCase} from './domain/usecases/ListUsbDevicesUseCase';
export {SendPhoneScanCommandUseCase} from './domain/usecases/SendPhoneScanCommandUseCase';
export {FlashFirmwareUseCase} from './domain/usecases/FlashFirmwareUseCase';
export {PickFirmwareFileUseCase} from './domain/usecases/PickFirmwareFileUseCase';

// Data layer (advanced integration)
export {NativeUsbSerialDataSource} from './data/NativeUsbSerialDataSource';
export {UsbSerialRepository} from './data/UsbSerialRepository';
export {NativeFirmwareFlashDataSource} from './data/NativeFirmwareFlashDataSource';
export {FirmwareFlashRepository} from './data/FirmwareFlashRepository';

// React hook
export {
  usePhoneScanScanner,
  type UsePhoneScanScannerState,
  type UsePhoneScanScannerActions,
  type UsePhoneScanScannerOptions,
  type RefreshDevicesOptions,
} from './hooks/usePhoneScanScanner';
