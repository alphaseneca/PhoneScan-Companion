import {ConnectScannerUseCase} from '../../src/domain/usecases/ConnectScannerUseCase';
import {createMockUsbSerial} from '../helpers/mockFactories';

describe('ConnectScannerUseCase', () => {
  it('requests permission then connects with options', async () => {
    const repo = createMockUsbSerial();
    const useCase = new ConnectScannerUseCase(repo);

    await useCase.execute(7, {baudRate: 57600});

    expect(repo.requestPermission).toHaveBeenCalledWith(7);
    expect(repo.connect).toHaveBeenCalledWith(7, {baudRate: 57600});
  });

  it('stops when USB permission is denied', async () => {
    const repo = createMockUsbSerial({
      requestPermission: jest.fn(async () => false),
    });
    const useCase = new ConnectScannerUseCase(repo);

    await expect(useCase.execute(1)).rejects.toThrow('USB permission denied');
    expect(repo.connect).not.toHaveBeenCalled();
  });
});
