import {BOOTLOADER_WAIT_TIMEOUT_MS} from '../../constants';
import type {FlashFirmwareOptions, FlashFirmwareResult} from '../entities/FirmwareTypes';
import type {IUsbSerialRepository} from '../repositories/IUsbSerialRepository';
import type {FirmwareFlashRepository} from '../../data/FirmwareFlashRepository';

/**
 * Enter CH55x bootloader (optional), wait for re-enumeration, then program flash.
 *
 * Edge cases handled:
 * - CDC detach after `bootloader` is expected (ignored)
 * - Permission denied on bootloader device
 * - Timeout if bootloader never appears (~5s window)
 * - Native flash / verify failures bubbled as errors
 */
export class FlashFirmwareUseCase {
  constructor(
    private readonly usbSerial: IUsbSerialRepository,
    private readonly firmwareFlash: FirmwareFlashRepository,
  ) {}

  async execute(options: FlashFirmwareOptions): Promise<FlashFirmwareResult> {
    if (!this.firmwareFlash.isFlashAvailable()) {
      throw new Error('Firmware flash requires Android with USB host (OTG).');
    }

    const enterBootloader = options.enterBootloader !== false;
    const waitTimeoutMs = options.waitTimeoutMs ?? BOOTLOADER_WAIT_TIMEOUT_MS;

    if (!options.firmwareBase64) {
      throw new Error('Firmware payload is required');
    }

    if (enterBootloader) {
      // Prefer an already-open CDC session; if not connected, assume the device
      // is already in bootloader or will be plugged in during the wait window.
      try {
        await this.usbSerial.sendCommand('bootloader');
      } catch {
        // Not connected — continue and look for an existing bootloader device.
      }

      // Give the CDC stack a moment to tear down before polling bootloader VID/PID.
      try {
        await this.usbSerial.disconnect();
      } catch {
        // Already disconnected after reboot — fine.
      }

      await delay(300);
    }

    let bootloader = (await this.firmwareFlash.listBootloaderDevices())[0];
    if (!bootloader) {
      bootloader = await this.firmwareFlash.waitForBootloader(waitTimeoutMs);
    }

    const granted = await this.firmwareFlash.requestBootloaderPermission(
      bootloader.deviceId,
    );
    if (!granted) {
      throw new Error('USB permission denied for CH55x bootloader');
    }

    return this.firmwareFlash.flashFirmware(
      bootloader.deviceId,
      options.firmwareBase64,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
