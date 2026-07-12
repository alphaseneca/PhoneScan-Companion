import type {FirmwareFilePayload} from '../entities/FirmwareTypes';
import type {FirmwareFlashRepository} from '../../data/FirmwareFlashRepository';

export class PickFirmwareFileUseCase {
  constructor(private readonly firmwareFlash: FirmwareFlashRepository) {}

  execute(): Promise<FirmwareFilePayload | null> {
    if (!this.firmwareFlash.isFlashAvailable()) {
      return Promise.reject(
        new Error('Firmware file picker requires Android.'),
      );
    }
    return this.firmwareFlash.pickFirmwareFile();
  }
}
