export const USB_SERIAL_EVENTS = {
  scan: 'UsbSerial:onScan',
  scanSignal: 'UsbSerial:onScanSignal',
  serialLine: 'UsbSerial:onSerialLine',
  connectionState: 'UsbSerial:onConnectionState',
  error: 'UsbSerial:onError',
} as const;

export type Parity = 'none' | 'odd' | 'even' | 'mark' | 'space';

export interface UsbDeviceInfo {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  hasPermission: boolean;
  isPhoneScan?: boolean;
}

export interface SerialConnectionOptions {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: Parity;
}

export interface ScanPayload {
  data: string;
  timestamp: number;
  length: number;
}

export interface SerialLinePayload {
  line: string;
  timestamp: number;
}

export interface ScanSignalPayload {
  timestamp: number;
}

export interface ConnectionStatePayload {
  connected: boolean;
  deviceId?: number;
  baudRate?: number;
}

export interface SerialErrorPayload {
  code: string;
  message: string;
}

export type ScanSource = 'serial';
