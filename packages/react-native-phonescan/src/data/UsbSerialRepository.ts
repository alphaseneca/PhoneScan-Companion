import type {NativeUsbSerialDataSource} from './NativeUsbSerialDataSource';
import type {IUsbSerialRepository} from '../domain/repositories/IUsbSerialRepository';
import type {SerialConnectionOptions} from '../domain/entities/UsbSerialTypes';

export class UsbSerialRepository implements IUsbSerialRepository {
  constructor(private readonly dataSource: NativeUsbSerialDataSource) {}

  isSerialAvailable(): boolean {
    return this.dataSource.isSerialAvailable();
  }

  listDevices() {
    return this.dataSource.listDevices();
  }

  requestPermission(deviceId: number) {
    return this.dataSource.requestPermission(deviceId);
  }

  connect(deviceId: number, options?: SerialConnectionOptions) {
    return this.dataSource.connect(deviceId, options);
  }

  disconnect() {
    return this.dataSource.disconnect();
  }

  sendCommand(command: string) {
    return this.dataSource.sendCommand(command);
  }

  onScan(listener: (value: string, timestamp: number) => void) {
    return this.dataSource.onScan(payload => {
      listener(payload.data, payload.timestamp);
    });
  }

  onSerialLine(listener: (line: string, timestamp: number) => void) {
    return this.dataSource.onSerialLine(payload => {
      listener(payload.line, payload.timestamp);
    });
  }

  onScanSignal(listener: (timestamp: number) => void) {
    return this.dataSource.onScanSignal(payload => {
      listener(payload.timestamp);
    });
  }

  onConnectionState(
    listener: (connected: boolean, deviceId?: number, baudRate?: number) => void,
  ) {
    return this.dataSource.onConnectionState(payload => {
      listener(payload.connected, payload.deviceId, payload.baudRate);
    });
  }

  onError(listener: (code: string, message: string) => void) {
    return this.dataSource.onError(payload => {
      listener(payload.code, payload.message);
    });
  }

  onDevicesChanged(listener: (reason: string, deviceId: number) => void) {
    return this.dataSource.onDevicesChanged(payload => {
      listener(payload.reason, payload.deviceId);
    });
  }
}
