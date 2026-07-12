import {FirmwareFlashRepository} from '../../src/data/FirmwareFlashRepository';
import type {NativeFirmwareFlashDataSource} from '../../src/data/NativeFirmwareFlashDataSource';

describe('FirmwareFlashRepository', () => {
  function createDs(
    overrides: Partial<jest.Mocked<NativeFirmwareFlashDataSource>> = {},
  ): jest.Mocked<NativeFirmwareFlashDataSource> {
    return {
      isFlashAvailable: jest.fn(() => true),
      pickFirmwareFile: jest.fn(async () => null),
      listBootloaderDevices: jest.fn(async () => []),
      waitForBootloader: jest.fn(async () => ({
        deviceId: 1,
        vendorId: 0x4348,
        productId: 0x55e0,
        deviceName: 'BL',
        hasPermission: true,
        isBootloader: true,
      })),
      requestBootloaderPermission: jest.fn(async () => true),
      flashFirmware: jest.fn(async () => ({
        success: true,
        bytesWritten: 10,
        bootloaderVersion: '2.3.1',
        mcuId: 1,
        chipId: [1],
      })),
      onProgress: jest.fn(() => jest.fn()),
      ...overrides,
    } as jest.Mocked<NativeFirmwareFlashDataSource>;
  }

  it('delegates flash availability and progress subscriptions', () => {
    const unsubscribe = jest.fn();
    const ds = createDs({
      onProgress: jest.fn(listener => {
        listener({
          phase: 'write',
          current: 1,
          total: 10,
          message: 'Writing',
        });
        return unsubscribe;
      }),
    });

    const repo = new FirmwareFlashRepository(ds);
    const onProgress = jest.fn();
    const stop = repo.onProgress(onProgress);

    expect(repo.isFlashAvailable()).toBe(true);
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'write',
      current: 1,
      total: 10,
      message: 'Writing',
    });
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('forwards bootloader discovery and flash calls', async () => {
    const ds = createDs();
    const repo = new FirmwareFlashRepository(ds);

    await repo.listBootloaderDevices();
    await repo.waitForBootloader(5000);
    await repo.requestBootloaderPermission(1);
    await repo.flashFirmware(1, 'QQ==');
    await repo.pickFirmwareFile();

    expect(ds.listBootloaderDevices).toHaveBeenCalled();
    expect(ds.waitForBootloader).toHaveBeenCalledWith(5000);
    expect(ds.requestBootloaderPermission).toHaveBeenCalledWith(1);
    expect(ds.flashFirmware).toHaveBeenCalledWith(1, 'QQ==');
    expect(ds.pickFirmwareFile).toHaveBeenCalled();
  });
});
