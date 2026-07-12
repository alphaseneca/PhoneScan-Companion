import type {IUsbSerialRepository} from '../../src/domain/repositories/IUsbSerialRepository';
import type {FirmwareFlashRepository} from '../../src/data/FirmwareFlashRepository';

/** Shared USB serial mock for use-case tests. */
export function createMockUsbSerial(
  overrides: Partial<IUsbSerialRepository> = {},
): jest.Mocked<IUsbSerialRepository> {
  return {
    listDevices: jest.fn(async () => []),
    requestPermission: jest.fn(async () => true),
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    sendCommand: jest.fn(async () => undefined),
    onScan: jest.fn(() => jest.fn()),
    onSerialLine: jest.fn(() => jest.fn()),
    onScanSignal: jest.fn(() => jest.fn()),
    onConnectionState: jest.fn(() => jest.fn()),
    onError: jest.fn(() => jest.fn()),
    isSerialAvailable: jest.fn(() => true),
    ...overrides,
  };
}

/** Shared firmware-flash mock for flash orchestration tests. */
export function createMockFirmwareFlash(
  overrides: Partial<FirmwareFlashRepository> = {},
): jest.Mocked<FirmwareFlashRepository> {
  return {
    isFlashAvailable: jest.fn(() => true),
    pickFirmwareFile: jest.fn(async () => null),
    listBootloaderDevices: jest.fn(async () => []),
    waitForBootloader: jest.fn(async () => ({
      deviceId: 42,
      vendorId: 0x4348,
      productId: 0x55e0,
      deviceName: 'CH55x',
      hasPermission: false,
      isBootloader: true,
    })),
    requestBootloaderPermission: jest.fn(async () => true),
    flashFirmware: jest.fn(async () => ({
      success: true,
      bytesWritten: 1024,
      bootloaderVersion: '2.3.1',
      mcuId: 0x55,
      chipId: [1, 2, 3, 4],
    })),
    onProgress: jest.fn(() => jest.fn()),
    ...overrides,
  } as jest.Mocked<FirmwareFlashRepository>;
}
