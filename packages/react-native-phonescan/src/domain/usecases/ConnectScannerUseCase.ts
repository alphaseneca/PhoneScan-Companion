import type {IUsbSerialRepository} from '../repositories/IUsbSerialRepository';
import type {SerialConnectionOptions} from '../entities/UsbSerialTypes';

export class ConnectScannerUseCase {
  constructor(private readonly repository: IUsbSerialRepository) {}

  async execute(deviceId: number, options?: SerialConnectionOptions): Promise<void> {
    const granted = await this.repository.requestPermission(deviceId);
    if (!granted) {
      throw new Error('USB permission denied');
    }

    await this.repository.connect(deviceId, options);
  }
}
