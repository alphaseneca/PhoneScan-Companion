import {
  CH55X_BOOTLOADER_PRODUCT_ID,
  CH55X_BOOTLOADER_VENDOR_ID,
  DEFAULT_BAUD_RATE,
  MAX_FIRMWARE_BYTES,
  PHONESCAN_PRODUCT_ID,
  PHONESCAN_PRODUCT_NAME,
  PHONESCAN_SCAN_SIGNAL,
  PHONESCAN_VENDOR_ID,
  BOOTLOADER_WAIT_TIMEOUT_MS,
} from '../src/constants';

describe('PhoneScan constants', () => {
  it('uses the official PhoneScan application VID/PID', () => {
    expect(PHONESCAN_VENDOR_ID).toBe(0x1209);
    expect(PHONESCAN_PRODUCT_ID).toBe(0xc55c);
    expect(PHONESCAN_PRODUCT_NAME).toBe('PhoneScan');
  });

  it('uses the CH55x ISP bootloader VID/PID', () => {
    expect(CH55X_BOOTLOADER_VENDOR_ID).toBe(0x4348);
    expect(CH55X_BOOTLOADER_PRODUCT_ID).toBe(0x55e0);
  });

  it('keeps CDC defaults aligned with the integration manual', () => {
    expect(DEFAULT_BAUD_RATE).toBe(57600);
    expect(PHONESCAN_SCAN_SIGNAL).toBe('[ scan ]');
    expect(BOOTLOADER_WAIT_TIMEOUT_MS).toBe(5000);
    expect(MAX_FIRMWARE_BYTES).toBe(63 * 1024);
  });
});
