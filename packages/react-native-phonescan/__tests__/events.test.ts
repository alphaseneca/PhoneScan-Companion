import {USB_SERIAL_EVENTS} from '../src/domain/entities/UsbSerialTypes';
import {FIRMWARE_FLASH_EVENTS} from '../src/domain/entities/FirmwareTypes';

describe('bridge event name contracts', () => {
  it('keeps USB serial event names stable for native/JS parity', () => {
    expect(USB_SERIAL_EVENTS.scan).toBe('UsbSerial:onScan');
    expect(USB_SERIAL_EVENTS.scanSignal).toBe('UsbSerial:onScanSignal');
    expect(USB_SERIAL_EVENTS.serialLine).toBe('UsbSerial:onSerialLine');
    expect(USB_SERIAL_EVENTS.connectionState).toBe('UsbSerial:onConnectionState');
    expect(USB_SERIAL_EVENTS.error).toBe('UsbSerial:onError');
    expect(USB_SERIAL_EVENTS.devicesChanged).toBe('UsbSerial:onDevicesChanged');
  });

  it('keeps firmware progress event name stable', () => {
    expect(FIRMWARE_FLASH_EVENTS.progress).toBe('FirmwareFlash:onProgress');
  });
});
