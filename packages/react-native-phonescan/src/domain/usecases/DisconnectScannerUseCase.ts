import type {IUsbSerialRepository} from '../repositories/IUsbSerialRepository';

export class DisconnectScannerUseCase {
  constructor(private readonly repository: IUsbSerialRepository) {}

  execute(): Promise<void> {
    return this.repository.disconnect();
  }
}
