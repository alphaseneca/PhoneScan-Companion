export const FIRMWARE_FLASH_EVENTS = {
  progress: 'FirmwareFlash:onProgress',
} as const;

export type FirmwareFormat = 'bin' | 'hex-image';

export interface FirmwareFilePayload {
  name: string;
  size: number;
  format: FirmwareFormat;
  /** Raw flash image (already parsed if source was Intel HEX). */
  base64: string;
}

export interface BootloaderDeviceInfo {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  hasPermission: boolean;
  isBootloader?: boolean;
}

export interface FlashProgressPayload {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export interface FlashFirmwareResult {
  success: boolean;
  bytesWritten: number;
  bootloaderVersion: string;
  mcuId: number;
  chipId: number[];
}

export interface FlashFirmwareOptions {
  /** Base64-encoded flash image (.bin bytes or parsed HEX). */
  firmwareBase64: string;
  /**
   * When true (default), send `bootloader` over CDC first, then wait for
   * the CH55x bootloader to appear (≈5s window).
   */
  enterBootloader?: boolean;
  /** Override bootloader wait window (ms). Default 5000. */
  waitTimeoutMs?: number;
}
