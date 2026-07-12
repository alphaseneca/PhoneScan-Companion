import {UsbSerialRepository} from '../../src/data/UsbSerialRepository';
import type {NativeUsbSerialDataSource} from '../../src/data/NativeUsbSerialDataSource';

function createDataSourceMock(): jest.Mocked<NativeUsbSerialDataSource> {
  return {
    isSerialAvailable: jest.fn(() => true),
    listDevices: jest.fn(async () => []),
    requestPermission: jest.fn(async () => true),
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    sendCommand: jest.fn(async () => undefined),
    onScan: jest.fn(listener => {
      listener({data: 'CODE', timestamp: 10, length: 4});
      return jest.fn();
    }),
    onSerialLine: jest.fn(listener => {
      listener({line: 'status', timestamp: 11});
      return jest.fn();
    }),
    onScanSignal: jest.fn(listener => {
      listener({timestamp: 12});
      return jest.fn();
    }),
    onConnectionState: jest.fn(listener => {
      listener({connected: true, deviceId: 1, baudRate: 57600});
      return jest.fn();
    }),
    onError: jest.fn(listener => {
      listener({code: 'READ_ERROR', message: 'lost'});
      return jest.fn();
    }),
  } as unknown as jest.Mocked<NativeUsbSerialDataSource>;
}

describe('UsbSerialRepository', () => {
  it('maps native scan payloads to (value, timestamp) listeners', () => {
    const ds = createDataSourceMock();
    const repo = new UsbSerialRepository(ds);
    const onScan = jest.fn();

    repo.onScan(onScan);

    expect(onScan).toHaveBeenCalledWith('CODE', 10);
  });

  it('maps connection and error events', () => {
    const ds = createDataSourceMock();
    const repo = new UsbSerialRepository(ds);
    const onState = jest.fn();
    const onError = jest.fn();

    repo.onConnectionState(onState);
    repo.onError(onError);

    expect(onState).toHaveBeenCalledWith(true, 1, 57600);
    expect(onError).toHaveBeenCalledWith('READ_ERROR', 'lost');
  });

  it('forwards lifecycle methods', async () => {
    const ds = createDataSourceMock();
    const repo = new UsbSerialRepository(ds);

    await repo.listDevices();
    await repo.requestPermission(5);
    await repo.connect(5, {baudRate: 115200});
    await repo.sendCommand('trig');
    await repo.disconnect();

    expect(ds.listDevices).toHaveBeenCalled();
    expect(ds.requestPermission).toHaveBeenCalledWith(5);
    expect(ds.connect).toHaveBeenCalledWith(5, {baudRate: 115200});
    expect(ds.sendCommand).toHaveBeenCalledWith('trig');
    expect(ds.disconnect).toHaveBeenCalled();
    expect(repo.isSerialAvailable()).toBe(true);
  });

  it('maps serial-line and scan-signal events', () => {
    const ds = createDataSourceMock();
    const repo = new UsbSerialRepository(ds);
    const onLine = jest.fn();
    const onSignal = jest.fn();

    repo.onSerialLine(onLine);
    repo.onScanSignal(onSignal);

    expect(onLine).toHaveBeenCalledWith('status', 11);
    expect(onSignal).toHaveBeenCalledWith(12);
  });
});
