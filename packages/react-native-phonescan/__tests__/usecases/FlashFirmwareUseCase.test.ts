import {FlashFirmwareUseCase} from '../../src/domain/usecases/FlashFirmwareUseCase';
import {PickFirmwareFileUseCase} from '../../src/domain/usecases/PickFirmwareFileUseCase';
import {createMockFirmwareFlash, createMockUsbSerial} from '../helpers/mockFactories';

describe('PickFirmwareFileUseCase', () => {
  it('returns the selected firmware payload', async () => {
    const file = {
      name: 'app.bin',
      size: 2048,
      format: 'bin' as const,
      base64: 'AAAA',
    };
    const flash = createMockFirmwareFlash({
      pickFirmwareFile: jest.fn(async () => file),
    });

    await expect(new PickFirmwareFileUseCase(flash).execute()).resolves.toEqual(
      file,
    );
  });

  it('rejects when the picker is unavailable off Android', async () => {
    const flash = createMockFirmwareFlash({
      isFlashAvailable: jest.fn(() => false),
    });
    await expect(new PickFirmwareFileUseCase(flash).execute()).rejects.toThrow(
      /requires Android/,
    );
  });
});

describe('FlashFirmwareUseCase', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function runFlash(useCase: FlashFirmwareUseCase, options: Parameters<FlashFirmwareUseCase['execute']>[0]) {
    const pending = useCase.execute(options);
    await jest.advanceTimersByTimeAsync(500);
    return pending;
  }

  it('rejects when flash is unavailable', async () => {
    const usb = createMockUsbSerial();
    const flash = createMockFirmwareFlash({
      isFlashAvailable: jest.fn(() => false),
    });
    const useCase = new FlashFirmwareUseCase(usb, flash);

    await expect(
      useCase.execute({firmwareBase64: 'AA=='}),
    ).rejects.toThrow(/Android with USB host/);
  });

  it('rejects missing firmware payload', async () => {
    const useCase = new FlashFirmwareUseCase(
      createMockUsbSerial(),
      createMockFirmwareFlash(),
    );

    await expect(useCase.execute({firmwareBase64: ''})).rejects.toThrow(
      'Firmware payload is required',
    );
  });

  it('sends bootloader, waits, requests permission, then flashes', async () => {
    const usb = createMockUsbSerial();
    const flash = createMockFirmwareFlash({
      listBootloaderDevices: jest.fn(async () => []),
    });
    const useCase = new FlashFirmwareUseCase(usb, flash);

    const resultPromise = runFlash(useCase, {
      firmwareBase64: 'QQ==',
      enterBootloader: true,
      waitTimeoutMs: 1000,
    });

    const result = await resultPromise;

    expect(usb.sendCommand).toHaveBeenCalledWith('bootloader');
    expect(usb.disconnect).toHaveBeenCalled();
    expect(flash.waitForBootloader).toHaveBeenCalledWith(1000);
    expect(flash.requestBootloaderPermission).toHaveBeenCalledWith(42);
    expect(flash.flashFirmware).toHaveBeenCalledWith(42, 'QQ==');
    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(1024);
  });

  it('uses an already-listed bootloader without waiting', async () => {
    const usb = createMockUsbSerial();
    const flash = createMockFirmwareFlash({
      listBootloaderDevices: jest.fn(async () => [
        {
          deviceId: 9,
          vendorId: 0x4348,
          productId: 0x55e0,
          deviceName: 'BL',
          hasPermission: true,
          isBootloader: true,
        },
      ]),
    });
    const useCase = new FlashFirmwareUseCase(usb, flash);

    const result = await runFlash(useCase, {
      firmwareBase64: 'QQ==',
      enterBootloader: false,
    });

    expect(usb.sendCommand).not.toHaveBeenCalled();
    expect(flash.waitForBootloader).not.toHaveBeenCalled();
    expect(flash.requestBootloaderPermission).toHaveBeenCalledWith(9);
    expect(flash.flashFirmware).toHaveBeenCalledWith(9, 'QQ==');
    expect(result.success).toBe(true);
  });

  it('continues when bootloader command fails (already in BL / not connected)', async () => {
    const usb = createMockUsbSerial({
      sendCommand: jest.fn(async () => {
        throw new Error('NOT_CONNECTED');
      }),
    });
    const flash = createMockFirmwareFlash();
    const useCase = new FlashFirmwareUseCase(usb, flash);

    await expect(
      runFlash(useCase, {firmwareBase64: 'QQ=='}),
    ).resolves.toMatchObject({success: true});
  });

  it('fails when bootloader USB permission is denied', async () => {
    const flash = createMockFirmwareFlash({
      requestBootloaderPermission: jest.fn(async () => false),
      listBootloaderDevices: jest.fn(async () => [
        {
          deviceId: 3,
          vendorId: 0x4348,
          productId: 0x55e0,
          deviceName: 'BL',
          hasPermission: false,
          isBootloader: true,
        },
      ]),
    });
    const useCase = new FlashFirmwareUseCase(createMockUsbSerial(), flash);

    await expect(
      useCase.execute({firmwareBase64: 'QQ==', enterBootloader: false}),
    ).rejects.toThrow(/permission denied/i);
    expect(flash.flashFirmware).not.toHaveBeenCalled();
  });
});
