import type {ScanSource} from './UsbSerialTypes';

export interface ScanResult {
  id: string;
  value: string;
  timestamp: number;
  length: number;
  source: ScanSource;
}

export function createScanResult(
  value: string,
  timestamp: number,
  source: ScanSource = 'serial',
): ScanResult {
  return {
    id: `${timestamp}-${value}`,
    value,
    timestamp,
    length: value.length,
    source,
  };
}
