import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

import type {
  ConnectionStatePayload,
  DevicesChangedPayload,
  ScanPayload,
  ScanSignalPayload,
  SerialConnectionOptions,
  SerialErrorPayload,
  SerialLinePayload,
  UsbDeviceInfo,
} from '../domain/entities/UsbSerialTypes';
import {USB_SERIAL_EVENTS} from '../domain/entities/UsbSerialTypes';

type UsbSerialNativeModule = {
  listDevices(): Promise<UsbDeviceInfo[]>;
  requestPermission(deviceId: number): Promise<boolean>;
  connect(deviceId: number, options?: SerialConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(command: string): Promise<void>;
};

class IosUsbSerialStub implements UsbSerialNativeModule {
  listDevices(): Promise<UsbDeviceInfo[]> {
    return Promise.resolve([]);
  }

  requestPermission(): Promise<boolean> {
    return Promise.resolve(false);
  }

  connect(): Promise<void> {
    return Promise.reject(
      new Error(
        'USB CDC serial is not available on iOS. PhoneScan scan capture requires Android with USB host (OTG).',
      ),
    );
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  sendCommand(): Promise<void> {
    return Promise.reject(
      new Error('USB CDC serial commands require Android.'),
    );
  }
}

const {UsbSerialModule} = NativeModules as {
  UsbSerialModule?: UsbSerialNativeModule;
};

function getModule(): UsbSerialNativeModule {
  if (Platform.OS === 'ios') {
    return new IosUsbSerialStub();
  }

  if (!UsbSerialModule) {
    throw new Error('UsbSerialModule is only available on Android');
  }

  return UsbSerialModule;
}

export class NativeUsbSerialDataSource {
  private emitter: NativeEventEmitter | null = null;

  constructor(private readonly eventEmitterFactory: () => NativeEventEmitter) {}

  isSerialAvailable(): boolean {
    return Platform.OS === 'android' && UsbSerialModule != null;
  }

  private getEmitter(): NativeEventEmitter {
    if (!this.emitter) {
      this.emitter = this.eventEmitterFactory();
    }
    return this.emitter;
  }

  listDevices(): Promise<UsbDeviceInfo[]> {
    return getModule().listDevices();
  }

  requestPermission(deviceId: number): Promise<boolean> {
    return getModule().requestPermission(deviceId);
  }

  connect(deviceId: number, options?: SerialConnectionOptions): Promise<void> {
    return getModule().connect(deviceId, options);
  }

  disconnect(): Promise<void> {
    return getModule().disconnect();
  }

  sendCommand(command: string): Promise<void> {
    return getModule().sendCommand(command);
  }

  onScan(listener: (payload: ScanPayload) => void): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.scan,
      listener,
    );
    return () => subscription.remove();
  }

  onSerialLine(listener: (payload: SerialLinePayload) => void): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.serialLine,
      listener,
    );
    return () => subscription.remove();
  }

  onScanSignal(listener: (payload: ScanSignalPayload) => void): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.scanSignal,
      listener,
    );
    return () => subscription.remove();
  }

  onConnectionState(listener: (payload: ConnectionStatePayload) => void): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.connectionState,
      listener,
    );
    return () => subscription.remove();
  }

  onError(listener: (payload: SerialErrorPayload) => void): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.error,
      listener,
    );
    return () => subscription.remove();
  }

  onDevicesChanged(
    listener: (payload: DevicesChangedPayload) => void,
  ): () => void {
    if (!this.isSerialAvailable()) {
      return () => undefined;
    }

    const subscription = this.getEmitter().addListener(
      USB_SERIAL_EVENTS.devicesChanged,
      listener,
    );
    return () => subscription.remove();
  }
}
