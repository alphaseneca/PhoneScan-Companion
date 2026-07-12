import type {
  SerialConnectionOptions,
  UsbDeviceInfo,
} from '../entities/UsbSerialTypes';

export interface IUsbSerialRepository {
  listDevices(): Promise<UsbDeviceInfo[]>;
  requestPermission(deviceId: number): Promise<boolean>;
  connect(deviceId: number, options?: SerialConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(command: string): Promise<void>;
  onScan(listener: (value: string, timestamp: number) => void): () => void;
  onSerialLine(listener: (line: string, timestamp: number) => void): () => void;
  onScanSignal(listener: (timestamp: number) => void): () => void;
  onConnectionState(
    listener: (connected: boolean, deviceId?: number, baudRate?: number) => void,
  ): () => void;
  onError(listener: (code: string, message: string) => void): () => void;
  onDevicesChanged(
    listener: (reason: string, deviceId: number) => void,
  ): () => void;
  isSerialAvailable(): boolean;
}
