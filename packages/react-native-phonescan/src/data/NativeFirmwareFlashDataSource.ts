import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

import type {
  BootloaderDeviceInfo,
  FirmwareFilePayload,
  FlashFirmwareResult,
  FlashProgressPayload,
} from '../domain/entities/FirmwareTypes';
import {FIRMWARE_FLASH_EVENTS} from '../domain/entities/FirmwareTypes';

type FirmwareFlashNativeModule = {
  listBootloaderDevices(): Promise<BootloaderDeviceInfo[]>;
  requestBootloaderPermission(deviceId: number): Promise<boolean>;
  waitForBootloader(timeoutMs: number): Promise<BootloaderDeviceInfo>;
  flashFirmware(
    deviceId: number,
    firmwareBase64: string,
  ): Promise<FlashFirmwareResult>;
  pickFirmwareFile(): Promise<FirmwareFilePayload | null>;
};

class IosFirmwareFlashStub implements FirmwareFlashNativeModule {
  listBootloaderDevices(): Promise<BootloaderDeviceInfo[]> {
    return Promise.resolve([]);
  }

  requestBootloaderPermission(): Promise<boolean> {
    return Promise.resolve(false);
  }

  waitForBootloader(): Promise<BootloaderDeviceInfo> {
    return Promise.reject(new Error('Firmware flash requires Android USB host.'));
  }

  flashFirmware(): Promise<FlashFirmwareResult> {
    return Promise.reject(new Error('Firmware flash requires Android USB host.'));
  }

  pickFirmwareFile(): Promise<FirmwareFilePayload | null> {
    return Promise.reject(new Error('Firmware file picker requires Android.'));
  }
}

const {FirmwareFlashModule} = NativeModules as {
  FirmwareFlashModule?: FirmwareFlashNativeModule;
};

function getModule(): FirmwareFlashNativeModule {
  if (Platform.OS === 'ios') {
    return new IosFirmwareFlashStub();
  }
  if (!FirmwareFlashModule) {
    throw new Error('FirmwareFlashModule is only available on Android');
  }
  return FirmwareFlashModule;
}

export class NativeFirmwareFlashDataSource {
  private emitter: NativeEventEmitter | null = null;

  constructor(private readonly eventEmitterFactory: () => NativeEventEmitter) {}

  isFlashAvailable(): boolean {
    return Platform.OS === 'android' && FirmwareFlashModule != null;
  }

  private getEmitter(): NativeEventEmitter {
    if (!this.emitter) {
      this.emitter = this.eventEmitterFactory();
    }
    return this.emitter;
  }

  listBootloaderDevices(): Promise<BootloaderDeviceInfo[]> {
    return getModule().listBootloaderDevices();
  }

  requestBootloaderPermission(deviceId: number): Promise<boolean> {
    return getModule().requestBootloaderPermission(deviceId);
  }

  waitForBootloader(timeoutMs: number): Promise<BootloaderDeviceInfo> {
    return getModule().waitForBootloader(timeoutMs);
  }

  flashFirmware(
    deviceId: number,
    firmwareBase64: string,
  ): Promise<FlashFirmwareResult> {
    return getModule().flashFirmware(deviceId, firmwareBase64);
  }

  pickFirmwareFile(): Promise<FirmwareFilePayload | null> {
    return getModule().pickFirmwareFile();
  }

  onProgress(listener: (payload: FlashProgressPayload) => void): () => void {
    if (!this.isFlashAvailable()) {
      return () => undefined;
    }
    const subscription = this.getEmitter().addListener(
      FIRMWARE_FLASH_EVENTS.progress,
      listener,
    );
    return () => subscription.remove();
  }
}
