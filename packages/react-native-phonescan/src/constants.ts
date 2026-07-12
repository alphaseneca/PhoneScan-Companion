/** PhoneScan USB device identifiers (see docs/devdocs.pdf). */
export const PHONESCAN_VENDOR_ID = 0x1209;
export const PHONESCAN_PRODUCT_ID = 0xc55c;
export const PHONESCAN_PRODUCT_NAME = 'PhoneScan';

/** CH55x ISP bootloader identity after `bootloader` serial command. */
export const CH55X_BOOTLOADER_VENDOR_ID = 0x4348;
export const CH55X_BOOTLOADER_PRODUCT_ID = 0x55e0;

/** Recommended CDC-ACM baud rate per integration manual. */
export const DEFAULT_BAUD_RATE = 57600;

export const BAUD_RATE_OPTIONS = [9600, 19200, 38400, 57600, 115200] as const;

export const MAX_SCAN_HISTORY = 100;

/** Serial prefix emitted before each successful decode on CDC. */
export const PHONESCAN_SCAN_SIGNAL = '[ scan ]';

/** Time window to catch the bootloader after sending `bootloader\\r\\n`. */
export const BOOTLOADER_WAIT_TIMEOUT_MS = 5000;

/** Max flash image size accepted by the CH55x web/ISP tools. */
export const MAX_FIRMWARE_BYTES = 63 * 1024;
