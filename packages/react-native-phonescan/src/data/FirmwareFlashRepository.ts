import type {NativeFirmwareFlashDataSource} from './NativeFirmwareFlashDataSource';
import type {
  BootloaderDeviceInfo,
  FirmwareFilePayload,
  FlashFirmwareResult,
  FlashProgressPayload,
} from '../domain/entities/FirmwareTypes';

export class FirmwareFlashRepository {
  constructor(private readonly dataSource: NativeFirmwareFlashDataSource) {}

  isFlashAvailable(): boolean {
    return this.dataSource.isFlashAvailable();
  }

  listBootloaderDevices(): Promise<BootloaderDeviceInfo[]> {
    return this.dataSource.listBootloaderDevices();
  }

  requestBootloaderPermission(deviceId: number): Promise<boolean> {
    return this.dataSource.requestBootloaderPermission(deviceId);
  }

  waitForBootloader(timeoutMs: number): Promise<BootloaderDeviceInfo> {
    return this.dataSource.waitForBootloader(timeoutMs);
  }

  flashFirmware(
    deviceId: number,
    firmwareBase64: string,
  ): Promise<FlashFirmwareResult> {
    return this.dataSource.flashFirmware(deviceId, firmwareBase64);
  }

  pickFirmwareFile(): Promise<FirmwareFilePayload | null> {
    return this.dataSource.pickFirmwareFile();
  }

  onProgress(listener: (payload: FlashProgressPayload) => void): () => void {
    return this.dataSource.onProgress(listener);
  }
}
