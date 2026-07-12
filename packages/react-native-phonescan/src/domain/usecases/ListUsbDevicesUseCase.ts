import type {IUsbSerialRepository} from '../repositories/IUsbSerialRepository';
import type {UsbDeviceInfo} from '../entities/UsbSerialTypes';

export class ListUsbDevicesUseCase {
  constructor(private readonly repository: IUsbSerialRepository) {}

  execute(): Promise<UsbDeviceInfo[]> {
    return this.repository.listDevices();
  }
}
