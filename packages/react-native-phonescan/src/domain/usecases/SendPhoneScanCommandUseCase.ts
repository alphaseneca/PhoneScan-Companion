import type {PhoneScanCommand} from '../entities/PhoneScan';
import type {IUsbSerialRepository} from '../repositories/IUsbSerialRepository';

/** Send a known `PHONESCAN_COMMANDS` value or any raw firmware command string. */
export class SendPhoneScanCommandUseCase {
  constructor(private readonly repository: IUsbSerialRepository) {}

  execute(command: PhoneScanCommand): Promise<void> {
    return this.repository.sendCommand(command);
  }
}
