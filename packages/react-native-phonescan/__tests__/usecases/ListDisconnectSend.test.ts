import {DisconnectScannerUseCase} from '../../src/domain/usecases/DisconnectScannerUseCase';
import {ListUsbDevicesUseCase} from '../../src/domain/usecases/ListUsbDevicesUseCase';
import {SendPhoneScanCommandUseCase} from '../../src/domain/usecases/SendPhoneScanCommandUseCase';
import {createMockUsbSerial} from '../helpers/mockFactories';

describe('ListUsbDevicesUseCase', () => {
  it('returns devices from the repository', async () => {
    const devices = [
      {
        deviceId: 1,
        vendorId: 0x1209,
        productId: 0xc55c,
        deviceName: 'PhoneScan',
        hasPermission: true,
        isPhoneScan: true,
      },
    ];
    const repo = createMockUsbSerial({
      listDevices: jest.fn(async () => devices),
    });

    await expect(new ListUsbDevicesUseCase(repo).execute()).resolves.toEqual(
      devices,
    );
  });
});

describe('DisconnectScannerUseCase', () => {
  it('delegates disconnect', async () => {
    const repo = createMockUsbSerial();
    await new DisconnectScannerUseCase(repo).execute();
    expect(repo.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('SendPhoneScanCommandUseCase', () => {
  it('sends known and raw firmware command strings', async () => {
    const repo = createMockUsbSerial();
    const useCase = new SendPhoneScanCommandUseCase(repo);

    await useCase.execute('status');
    await useCase.execute('custom-fw-cmd');

    expect(repo.sendCommand).toHaveBeenNthCalledWith(1, 'status');
    expect(repo.sendCommand).toHaveBeenNthCalledWith(2, 'custom-fw-cmd');
  });
});
