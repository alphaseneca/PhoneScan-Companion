import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';

jest.mock('../src/core/di/container', () => ({
  appContainer: {
    platform: 'android',
    listUsbDevices: {execute: jest.fn(async () => [])},
    connectScanner: {execute: jest.fn(async () => undefined)},
    disconnectScanner: {execute: jest.fn(async () => undefined)},
    sendPhoneScanCommand: {execute: jest.fn(async () => undefined)},
    pickFirmwareFile: {execute: jest.fn(async () => null)},
    flashFirmware: {execute: jest.fn(async () => undefined)},
    usbSerialRepository: {
      isSerialAvailable: jest.fn(() => true),
      onScan: jest.fn(() => jest.fn()),
      onSerialLine: jest.fn(() => jest.fn()),
      onScanSignal: jest.fn(() => jest.fn()),
      onConnectionState: jest.fn(() => jest.fn()),
      onError: jest.fn(() => jest.fn()),
      onDevicesChanged: jest.fn(() => jest.fn()),
    },
    firmwareFlashRepository: {
      onProgress: jest.fn(() => jest.fn()),
    },
  },
}));

jest.mock('../src/settings/storage', () => ({
  loadCompanionSettings: jest.fn(async () => ({autoConnect: false})),
  saveCompanionSettings: jest.fn(async () => undefined),
}));

test('renders PhoneScan Companion screen', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
