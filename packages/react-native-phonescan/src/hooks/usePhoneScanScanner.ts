import {useCallback, useEffect, useRef, useState} from 'react';

import {DEFAULT_BAUD_RATE, MAX_SCAN_HISTORY} from '../constants';
import type {PhoneScanClient} from '../createPhoneScanClient';
import {createScanResult, type ScanResult} from '../domain/entities/ScanResult';
import {
  isPhoneScanDevice,
  parsePhoneScanStatus,
  type PhoneScanCommand,
  type PhoneScanStatus,
} from '../domain/entities/PhoneScan';
import type {
  FirmwareFilePayload,
  FlashProgressPayload,
} from '../domain/entities/FirmwareTypes';
import type {UsbDeviceInfo} from '../domain/entities/UsbSerialTypes';

type ScannerStatus = 'idle' | 'connecting' | 'connected' | 'error';
type FlashStatus = 'idle' | 'picking' | 'flashing' | 'success' | 'error';

interface ThroughputSample {
  timestamp: number;
  chars: number;
}

export interface UsePhoneScanScannerState {
  devices: UsbDeviceInfo[];
  selectedDeviceId: number | null;
  baudRate: number;
  status: ScannerStatus;
  isRefreshing: boolean;
  latestScan: ScanResult | null;
  scanHistory: ScanResult[];
  scansPerSecond: number;
  charsPerSecond: number;
  errorMessage: string | null;
  serialLog: string[];
  deviceStatus: PhoneScanStatus | null;
  serialAvailable: boolean;
  lastScanSignalAt: number | null;
  firmwareFile: FirmwareFilePayload | null;
  flashStatus: FlashStatus;
  flashProgress: FlashProgressPayload | null;
  flashMessage: string | null;
}

export interface UsePhoneScanScannerActions {
  refreshDevices: () => Promise<void>;
  selectDevice: (deviceId: number) => void;
  setBaudRate: (baudRate: number) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearHistory: () => void;
  sendCommand: (command: PhoneScanCommand) => Promise<void>;
  clearSerialLog: () => void;
  pickFirmware: () => Promise<void>;
  clearFirmware: () => void;
  flashFirmware: () => Promise<void>;
}

export interface UsePhoneScanScannerOptions {
  /**
   * When true, automatically connect once a suitable USB device is listed
   * and the session is idle. Host apps should persist this in their settings.
   */
  autoConnect?: boolean;
  /** Poll interval for device discovery while auto-connect is on (ms). */
  autoConnectPollMs?: number;
}

/**
 * Presentation hook for PhoneScan CDC capture + CH55x firmware update.
 *
 * First principles:
 * - Hardware I/O stays in the native modules; this hook only orchestrates UI state.
 * - Scan hot path never awaits history/metrics (paint latestScan immediately).
 * - Firmware flash owns the USB bus — suppress detach errors during bootloader entry.
 * - Auto-connect is optional and host-controlled so Companion settings can toggle it.
 */
export function usePhoneScanScanner(
  client: PhoneScanClient,
  options: UsePhoneScanScannerOptions = {},
): UsePhoneScanScannerState & UsePhoneScanScannerActions {
  const autoConnect = options.autoConnect === true;
  const autoConnectPollMs = options.autoConnectPollMs ?? 2000;
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [baudRate, setBaudRate] = useState(DEFAULT_BAUD_RATE);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [scansPerSecond, setScansPerSecond] = useState(0);
  const [charsPerSecond, setCharsPerSecond] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<PhoneScanStatus | null>(null);
  const [lastScanSignalAt, setLastScanSignalAt] = useState<number | null>(null);
  const [firmwareFile, setFirmwareFile] = useState<FirmwareFilePayload | null>(
    null,
  );
  const [flashStatus, setFlashStatus] = useState<FlashStatus>('idle');
  const [flashProgress, setFlashProgress] = useState<FlashProgressPayload | null>(
    null,
  );
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const throughputRef = useRef<ThroughputSample[]>([]);
  const pendingHistoryRef = useRef<ScanResult[]>([]);
  const historyFlushRafRef = useRef<number | null>(null);
  const flashingRef = useRef(false);
  const statusRef = useRef<ScannerStatus>('idle');
  const selectedDeviceIdRef = useRef<number | null>(null);
  const autoConnectAttemptRef = useRef<number | null>(null);
  const connectInFlightRef = useRef(false);

  const serialAvailable = client.usbSerialRepository.isSerialAvailable();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const flushHistory = useCallback(() => {
    historyFlushRafRef.current = null;
    const pending = pendingHistoryRef.current;
    if (pending.length === 0) {
      return;
    }
    pendingHistoryRef.current = [];
    setScanHistory(previous => [...pending, ...previous].slice(0, MAX_SCAN_HISTORY));
  }, []);

  const scheduleHistoryFlush = useCallback(() => {
    if (historyFlushRafRef.current != null) {
      return;
    }
    historyFlushRafRef.current = requestAnimationFrame(flushHistory);
  }, [flushHistory]);

  const updateThroughput = useCallback((timestamp: number, chars: number) => {
    const windowStart = timestamp - 1000;
    const next = throughputRef.current.filter(sample => sample.timestamp >= windowStart);
    next.push({timestamp, chars});
    throughputRef.current = next;
    setScansPerSecond(next.length);
    setCharsPerSecond(next.reduce((sum, sample) => sum + sample.chars, 0));
  }, []);

  const recordScan = useCallback(
    (value: string, timestamp: number) => {
      const scan = createScanResult(value, timestamp, 'serial');

      setLatestScan(scan);

      pendingHistoryRef.current.unshift(scan);
      if (pendingHistoryRef.current.length > MAX_SCAN_HISTORY) {
        pendingHistoryRef.current.length = MAX_SCAN_HISTORY;
      }
      scheduleHistoryFlush();
      updateThroughput(timestamp, value.length);
    },
    [scheduleHistoryFlush, updateThroughput],
  );

  const appendSerialLog = useCallback((line: string) => {
    setSerialLog(previous => [line, ...previous].slice(0, 40));
    const parsed = parsePhoneScanStatus(line);
    if (parsed) {
      setDeviceStatus(parsed);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!serialAvailable) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const nextDevices = await client.listUsbDevices.execute();
      const sorted = [...nextDevices].sort((a, b) => {
        const aPhone = a.isPhoneScan || isPhoneScanDevice(a.vendorId, a.productId);
        const bPhone = b.isPhoneScan || isPhoneScanDevice(b.vendorId, b.productId);
        return Number(bPhone) - Number(aPhone);
      });

      setDevices(sorted);

      if (sorted.length === 0) {
        setSelectedDeviceId(null);
      } else if (
        selectedDeviceId == null ||
        !sorted.some(device => device.deviceId === selectedDeviceId)
      ) {
        setSelectedDeviceId(sorted[0].deviceId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to list USB devices',
      );
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  }, [client, selectedDeviceId, serialAvailable]);

  const connect = useCallback(async () => {
    if (!serialAvailable) {
      setErrorMessage('USB CDC serial requires Android with OTG support.');
      return;
    }

    const deviceId = selectedDeviceIdRef.current;
    if (deviceId == null) {
      setErrorMessage('Select a PhoneScan device first');
      return;
    }

    if (connectInFlightRef.current || flashingRef.current) {
      return;
    }

    connectInFlightRef.current = true;
    setStatus('connecting');
    setErrorMessage(null);

    const attemptConnect = async () => {
      await client.connectScanner.execute(deviceId, {baudRate});
    };

    try {
      try {
        await attemptConnect();
      } catch {
        // One retry covers transient USB open races after plug-in.
        await new Promise<void>(resolve => {
          setTimeout(resolve, 350);
        });
        await attemptConnect();
      }

      setStatus('connected');
      autoConnectAttemptRef.current = deviceId;

      try {
        await client.sendPhoneScanCommand.execute('status');
      } catch {
        // Connected successfully; status query is best-effort.
      }
    } catch (error) {
      setStatus('idle');
      // Remember this device so auto-connect does not spam retries until unplug.
      autoConnectAttemptRef.current = deviceId;
      setErrorMessage(
        error instanceof Error
          ? `${error.message} — unplug/replug, then Connect again.`
          : 'Failed to connect',
      );
      refreshDevices().catch(() => undefined);
    } finally {
      connectInFlightRef.current = false;
    }
  }, [baudRate, client, refreshDevices, serialAvailable]);

  const disconnect = useCallback(async () => {
    if (!serialAvailable) {
      setStatus('idle');
      return;
    }

    try {
      await client.disconnectScanner.execute();
      setStatus('idle');
      setDeviceStatus(null);
      setErrorMessage(null);
    } catch (error) {
      setStatus('idle');
      setDeviceStatus(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to disconnect',
      );
    }
  }, [client, serialAvailable]);

  const sendCommand = useCallback(
    async (command: PhoneScanCommand) => {
      setErrorMessage(null);
      try {
        await client.sendPhoneScanCommand.execute(command);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : `Failed to send: ${command}`,
        );
      }
    },
    [client],
  );

  const clearHistory = useCallback(() => {
    if (historyFlushRafRef.current != null) {
      cancelAnimationFrame(historyFlushRafRef.current);
      historyFlushRafRef.current = null;
    }
    pendingHistoryRef.current = [];
    throughputRef.current = [];
    setLatestScan(null);
    setScanHistory([]);
    setScansPerSecond(0);
    setCharsPerSecond(0);
  }, []);

  const clearSerialLog = useCallback(() => {
    setSerialLog([]);
  }, []);

  const pickFirmware = useCallback(async () => {
    setFlashMessage(null);
    setFlashStatus('picking');
    try {
      const file = await client.pickFirmwareFile.execute();
      if (file) {
        setFirmwareFile(file);
        setFlashStatus('idle');
        setFlashMessage(`${file.name} · ${file.size} bytes`);
      } else {
        setFlashStatus('idle');
      }
    } catch (error) {
      setFlashStatus('error');
      setFlashMessage(
        error instanceof Error ? error.message : 'Could not open firmware file',
      );
    }
  }, [client]);

  const clearFirmware = useCallback(() => {
    setFirmwareFile(null);
    setFlashProgress(null);
    setFlashMessage(null);
    setFlashStatus('idle');
  }, []);

  const flashFirmware = useCallback(async () => {
    if (!firmwareFile) {
      setFlashMessage('Select a .bin or .hex file first');
      setFlashStatus('error');
      return;
    }

    flashingRef.current = true;
    setFlashStatus('flashing');
    setFlashProgress(null);
    setFlashMessage('Entering bootloader…');
    setErrorMessage(null);

    try {
      const result = await client.flashFirmware.execute({
        firmwareBase64: firmwareFile.base64,
        enterBootloader: true,
      });
      setFlashStatus('success');
      setFlashMessage(
        `Flashed ${result.bytesWritten} bytes · BL ${result.bootloaderVersion}`,
      );
      setStatus('idle');
      setDeviceStatus(null);
      // Device reboots as PhoneScan — refresh after a short settle.
      await new Promise<void>(resolve => {
        setTimeout(resolve, 800);
      });
      await refreshDevices();
    } catch (error) {
      setFlashStatus('error');
      setFlashMessage(
        error instanceof Error ? error.message : 'Firmware flash failed',
      );
      refreshDevices().catch(() => undefined);
    } finally {
      flashingRef.current = false;
    }
  }, [client, firmwareFile, refreshDevices]);

  useEffect(() => {
    if (serialAvailable) {
      refreshDevices().catch(() => undefined);
    }
  }, [refreshDevices, serialAvailable]);

  // Auto-connect: when enabled, poll for devices while idle and connect once.
  useEffect(() => {
    if (!serialAvailable || !autoConnect) {
      return undefined;
    }

    const tick = () => {
      if (
        flashingRef.current ||
        connectInFlightRef.current ||
        statusRef.current === 'connected' ||
        statusRef.current === 'connecting'
      ) {
        return;
      }
      refreshDevices().catch(() => undefined);
    };

    tick();
    const timer = setInterval(tick, autoConnectPollMs);
    return () => clearInterval(timer);
  }, [autoConnect, autoConnectPollMs, refreshDevices, serialAvailable]);

  // After device list updates, attempt auto-connect to the preferred device.
  useEffect(() => {
    if (!autoConnect || !serialAvailable || flashingRef.current) {
      return;
    }
    if (status !== 'idle' || connectInFlightRef.current) {
      return;
    }
    if (selectedDeviceId == null) {
      autoConnectAttemptRef.current = null;
      return;
    }
    // Avoid hammering the same device after a failed attempt until list changes.
    if (autoConnectAttemptRef.current === selectedDeviceId) {
      return;
    }
    connect().catch(() => undefined);
  }, [autoConnect, connect, selectedDeviceId, serialAvailable, status, devices]);

  useEffect(() => {
    if (!serialAvailable) {
      return undefined;
    }

    const unsubscribeScan = client.usbSerialRepository.onScan((value, timestamp) => {
      recordScan(value, timestamp);
    });

    const unsubscribeLine = client.usbSerialRepository.onSerialLine(line => {
      appendSerialLog(line);
    });

    const unsubscribeSignal = client.usbSerialRepository.onScanSignal(timestamp => {
      setLastScanSignalAt(timestamp);
    });

    const unsubscribeState = client.usbSerialRepository.onConnectionState(
      connected => {
        // Expected detach while entering bootloader — don't clobber flash UI.
        if (!connected && flashingRef.current) {
          setStatus('idle');
          setDeviceStatus(null);
          return;
        }
        setStatus(connected ? 'connected' : 'idle');
        if (!connected) {
          setDeviceStatus(null);
          refreshDevices().catch(() => undefined);
        }
      },
    );

    const unsubscribeError = client.usbSerialRepository.onError((code, message) => {
      const lost =
        code === 'DEVICE_DETACHED' ||
        code === 'READ_ERROR' ||
        code === 'WRITE_FAILED';
      if (flashingRef.current && lost) {
        // Detach after `bootloader` is expected.
        setStatus('idle');
        setDeviceStatus(null);
        return;
      }
      setErrorMessage(message);
      setStatus(lost ? 'idle' : 'error');
      if (lost) {
        setDeviceStatus(null);
        refreshDevices().catch(() => undefined);
      }
    });

    const unsubscribeFlash =
      client.firmwareFlashRepository.onProgress(progress => {
        setFlashProgress(progress);
        setFlashMessage(progress.message);
      });

    return () => {
      unsubscribeScan();
      unsubscribeLine();
      unsubscribeSignal();
      unsubscribeState();
      unsubscribeError();
      unsubscribeFlash();
      if (historyFlushRafRef.current != null) {
        cancelAnimationFrame(historyFlushRafRef.current);
      }
    };
  }, [appendSerialLog, client, recordScan, refreshDevices, serialAvailable]);

  return {
    devices,
    selectedDeviceId,
    baudRate,
    status,
    isRefreshing,
    latestScan,
    scanHistory,
    scansPerSecond,
    charsPerSecond,
    errorMessage,
    serialLog,
    deviceStatus,
    serialAvailable,
    lastScanSignalAt,
    firmwareFile,
    flashStatus,
    flashProgress,
    flashMessage,
    refreshDevices,
    selectDevice: setSelectedDeviceId,
    setBaudRate,
    connect,
    disconnect,
    clearHistory,
    sendCommand,
    clearSerialLog,
    pickFirmware,
    clearFirmware,
    flashFirmware,
  };
}
