import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

import {NativeFirmwareFlashDataSource} from './data/NativeFirmwareFlashDataSource';
import {FirmwareFlashRepository} from './data/FirmwareFlashRepository';
import {NativeUsbSerialDataSource} from './data/NativeUsbSerialDataSource';
import {UsbSerialRepository} from './data/UsbSerialRepository';
import {ConnectScannerUseCase} from './domain/usecases/ConnectScannerUseCase';
import {DisconnectScannerUseCase} from './domain/usecases/DisconnectScannerUseCase';
import {FlashFirmwareUseCase} from './domain/usecases/FlashFirmwareUseCase';
import {ListUsbDevicesUseCase} from './domain/usecases/ListUsbDevicesUseCase';
import {PickFirmwareFileUseCase} from './domain/usecases/PickFirmwareFileUseCase';
import {SendPhoneScanCommandUseCase} from './domain/usecases/SendPhoneScanCommandUseCase';
import type {IUsbSerialRepository} from './domain/repositories/IUsbSerialRepository';
import type {FirmwareFlashRepository as IFirmwareFlashRepository} from './data/FirmwareFlashRepository';

/**
 * Wired client surface. New firmware capabilities should appear as additional
 * use-case fields here (and matching native @ReactMethod entries), not by
 * overloading a single mega-method.
 */
export interface PhoneScanClient {
  platform: string;
  listUsbDevices: ListUsbDevicesUseCase;
  connectScanner: ConnectScannerUseCase;
  disconnectScanner: DisconnectScannerUseCase;
  sendPhoneScanCommand: SendPhoneScanCommandUseCase;
  flashFirmware: FlashFirmwareUseCase;
  pickFirmwareFile: PickFirmwareFileUseCase;
  usbSerialRepository: IUsbSerialRepository;
  firmwareFlashRepository: IFirmwareFlashRepository;
}

/**
 * Create a wired PhoneScan client (repository + use cases).
 * Call once at app startup and pass the result to hooks or your own UI layer.
 */
export function createPhoneScanClient(): PhoneScanClient {
  const serialDataSource = new NativeUsbSerialDataSource(
    () => new NativeEventEmitter(NativeModules.UsbSerialModule),
  );
  const flashDataSource = new NativeFirmwareFlashDataSource(
    () => new NativeEventEmitter(NativeModules.FirmwareFlashModule),
  );
  const usbSerialRepository = new UsbSerialRepository(serialDataSource);
  const firmwareFlashRepository = new FirmwareFlashRepository(flashDataSource);

  return {
    platform: Platform.OS,
    listUsbDevices: new ListUsbDevicesUseCase(usbSerialRepository),
    connectScanner: new ConnectScannerUseCase(usbSerialRepository),
    disconnectScanner: new DisconnectScannerUseCase(usbSerialRepository),
    sendPhoneScanCommand: new SendPhoneScanCommandUseCase(usbSerialRepository),
    flashFirmware: new FlashFirmwareUseCase(
      usbSerialRepository,
      firmwareFlashRepository,
    ),
    pickFirmwareFile: new PickFirmwareFileUseCase(firmwareFlashRepository),
    usbSerialRepository,
    firmwareFlashRepository,
  };
}

/** Default singleton for quick integration. */
export const defaultPhoneScanClient = createPhoneScanClient();
