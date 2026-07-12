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

export interface RefreshDevicesOptions {
  /** When true, skip Refresh spinner / error UI (background / auto-connect polls). */
  silent?: boolean;
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
  refreshDevices: (options?: RefreshDevicesOptions) => Promise<void>;
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

const DEFAULT_AUTO_CONNECT_POLL_MS = 5000;
const THROUGHPUT_UI_INTERVAL_MS = 250;

function sameDeviceList(a: UsbDeviceInfo[], b: UsbDeviceInfo[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.deviceId !== right.deviceId ||
      left.vendorId !== right.vendorId ||
      left.productId !== right.productId ||
      left.hasPermission !== right.hasPermission ||
      Boolean(left.isPhoneScan) !== Boolean(right.isPhoneScan)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Presentation hook for PhoneScan CDC capture + CH55x firmware update.
 *
 * Responsibilities:
 * - Enumerate USB devices and open a CDC session
 * - Paint `latestScan` on the hot path; batch history/metrics off the critical path
 * - Optional auto-connect while idle (host supplies the preference)
 * - Own firmware pick/flash UI state; suppress expected detach noise during bootloader entry
 *
 * Auto-connect latch (`autoConnectAttemptRef`):
 * - Set after a connect attempt (success or failure) and after intentional disconnect
 * - Cleared when the selected device disappears, when auto-connect is enabled, or after flash settles
 * - Prevents connect spam and prevents instant re-open after the user disconnects
 */
export function usePhoneScanScanner(
  client: PhoneScanClient,
  options: UsePhoneScanScannerOptions = {},
): UsePhoneScanScannerState & UsePhoneScanScannerActions {
  const autoConnect = options.autoConnect === true;
  const autoConnectPollMs =
    options.autoConnectPollMs ?? DEFAULT_AUTO_CONNECT_POLL_MS;
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
  /** See hook doc — suppress auto-connect for this device id until cleared. */
  const autoConnectAttemptRef = useRef<number | null>(null);
  const connectInFlightRef = useRef(false);
  /** Bumped on disconnect so an in-flight connect cannot mark the session connected. */
  const connectGenerationRef = useRef(0);
  const lastThroughputUiAtRef = useRef(0);
  const pendingThroughputRef = useRef({scans: 0, chars: 0});
  const throughputFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
    const next = throughputRef.current.filter(
      sample => sample.timestamp >= windowStart,
    );
    next.push({timestamp, chars});
    throughputRef.current = next;

    const scans = next.length;
    const totalChars = next.reduce((sum, sample) => sum + sample.chars, 0);
    pendingThroughputRef.current = {scans, chars: totalChars};

    const flush = () => {
      throughputFlushTimerRef.current = null;
      lastThroughputUiAtRef.current = Date.now();
      const pending = pendingThroughputRef.current;
      setScansPerSecond(pending.scans);
      setCharsPerSecond(pending.chars);
    };

    const elapsed = Date.now() - lastThroughputUiAtRef.current;
    if (elapsed >= THROUGHPUT_UI_INTERVAL_MS) {
      if (throughputFlushTimerRef.current != null) {
        clearTimeout(throughputFlushTimerRef.current);
        throughputFlushTimerRef.current = null;
      }
      flush();
      return;
    }

    if (throughputFlushTimerRef.current == null) {
      throughputFlushTimerRef.current = setTimeout(
        flush,
        THROUGHPUT_UI_INTERVAL_MS - elapsed,
      );
    }
  }, []);

  // Decay throughput to zero after scanning stops (window is time-based).
  useEffect(() => {
    if (scansPerSecond === 0 && charsPerSecond === 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      const next = throughputRef.current.filter(
        sample => sample.timestamp >= now - 1000,
      );
      throughputRef.current = next;
      const scans = next.length;
      const totalChars = next.reduce((sum, sample) => sum + sample.chars, 0);
      pendingThroughputRef.current = {scans, chars: totalChars};
      setScansPerSecond(scans);
      setCharsPerSecond(totalChars);
    }, THROUGHPUT_UI_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [scansPerSecond, charsPerSecond]);

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

  const refreshDevices = useCallback(
    async (options?: RefreshDevicesOptions) => {
      if (!serialAvailable) {
        return;
      }

      const silent = options?.silent === true;
      if (!silent) {
        setIsRefreshing(true);
        setErrorMessage(null);
        // Manual refresh is an explicit recovery intent.
        autoConnectAttemptRef.current = null;
      }

      try {
        const nextDevices = await client.listUsbDevices.execute();
        const sorted = [...nextDevices].sort((a, b) => {
          const aPhone =
            a.isPhoneScan || isPhoneScanDevice(a.vendorId, a.productId);
          const bPhone =
            b.isPhoneScan || isPhoneScanDevice(b.vendorId, b.productId);
          return Number(bPhone) - Number(aPhone);
        });

        setDevices(previous =>
          sameDeviceList(previous, sorted) ? previous : sorted,
        );

        const currentSelected = selectedDeviceIdRef.current;
        if (sorted.length === 0) {
          if (currentSelected != null) {
            setSelectedDeviceId(null);
          }
          autoConnectAttemptRef.current = null;
        } else if (
          currentSelected == null ||
          !sorted.some(device => device.deviceId === currentSelected)
        ) {
          setSelectedDeviceId(sorted[0].deviceId);
          autoConnectAttemptRef.current = null;
        }
      } catch (error) {
        if (!silent) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to list USB devices',
          );
          setStatus('error');
        }
      } finally {
        if (!silent) {
          setIsRefreshing(false);
        }
      }
    },
    [client, serialAvailable],
  );

  const handleSessionLost = useCallback(
    (message: string | null) => {
      connectGenerationRef.current += 1;
      connectInFlightRef.current = false;
      autoConnectAttemptRef.current = null;
      setStatus('idle');
      setDeviceStatus(null);
      setErrorMessage(message);
      refreshDevices({silent: true}).catch(() => undefined);
    },
    [refreshDevices],
  );

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

    const generation = connectGenerationRef.current;
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
        if (connectGenerationRef.current !== generation) {
          return;
        }
        await attemptConnect();
      }

      if (connectGenerationRef.current !== generation) {
        await client.disconnectScanner.execute().catch(() => undefined);
        return;
      }

      setStatus('connected');
      autoConnectAttemptRef.current = deviceId;

      try {
        await client.sendPhoneScanCommand.execute('status');
      } catch {
        // Connected successfully; status query is best-effort.
      }
    } catch (error) {
      if (connectGenerationRef.current !== generation) {
        return;
      }
      setStatus('idle');
      const message =
        error instanceof Error ? error.message : 'Failed to connect';
      const unplugged =
        /unplug|detach|DEVICE_DETACHED|DEVICE_NOT_FOUND/i.test(message);
      if (unplugged) {
        autoConnectAttemptRef.current = null;
        setErrorMessage('Scanner unplugged during connect');
      } else {
        autoConnectAttemptRef.current = deviceId;
        setErrorMessage(
          `${message} — unplug/replug, then Connect again.`,
        );
      }
      refreshDevices({silent: true}).catch(() => undefined);
    } finally {
      if (connectGenerationRef.current === generation) {
        connectInFlightRef.current = false;
      }
    }
  }, [baudRate, client, refreshDevices, serialAvailable]);

  const disconnect = useCallback(async () => {
    connectGenerationRef.current += 1;
    connectInFlightRef.current = false;
    // Keep auto-connect from immediately re-opening this same device.
    autoConnectAttemptRef.current = selectedDeviceIdRef.current;

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
    if (throughputFlushTimerRef.current != null) {
      clearTimeout(throughputFlushTimerRef.current);
      throughputFlushTimerRef.current = null;
    }
    pendingHistoryRef.current = [];
    throughputRef.current = [];
    pendingThroughputRef.current = {scans: 0, chars: 0};
    lastThroughputUiAtRef.current = 0;
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
      setFirmwareFile(null);
      setFlashProgress(null);
      setFlashStatus('success');
      setFlashMessage(
        `Flashed ${result.bytesWritten} bytes · BL ${result.bootloaderVersion}`,
      );
      setStatus('idle');
      setDeviceStatus(null);
    } catch (error) {
      setFlashStatus('error');
      setFlashMessage(
        error instanceof Error ? error.message : 'Firmware flash failed',
      );
    } finally {
      flashingRef.current = false;
    }

    // Allow auto-connect after the device reboots as PhoneScan.
    autoConnectAttemptRef.current = null;
    await new Promise<void>(resolve => {
      setTimeout(resolve, 800);
    });
    await refreshDevices({silent: true}).catch(() => undefined);
  }, [client, firmwareFile, refreshDevices]);

  // Silent discovery on mount (spinner reserved for manual Refresh).
  useEffect(() => {
    if (serialAvailable) {
      refreshDevices({silent: true}).catch(() => undefined);
    }
  }, [refreshDevices, serialAvailable]);

  // Enabling auto-connect clears the latch so a fresh attempt can run.
  useEffect(() => {
    if (autoConnect) {
      autoConnectAttemptRef.current = null;
    }
  }, [autoConnect]);

  // Background discovery while auto-connect is on and the session is idle.
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
      refreshDevices({silent: true}).catch(() => undefined);
    };

    tick();
    const timer = setInterval(tick, autoConnectPollMs);
    return () => clearInterval(timer);
  }, [autoConnect, autoConnectPollMs, refreshDevices, serialAvailable]);

  // Connect when a preferred device appears and the latch allows it.
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
        if (connected) {
          setStatus('connected');
          setErrorMessage(null);
          return;
        }
        handleSessionLost(null);
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
      if (lost) {
        handleSessionLost(
          code === 'DEVICE_DETACHED'
            ? 'Scanner unplugged'
            : message || 'USB connection lost',
        );
        return;
      }
      setErrorMessage(message);
      setStatus('error');
    });

    const unsubscribeDevicesChanged =
      client.usbSerialRepository.onDevicesChanged((reason, _deviceId) => {
        if (reason === 'detached') {
          autoConnectAttemptRef.current = null;
          if (
            statusRef.current === 'connecting' ||
            statusRef.current === 'connected'
          ) {
            // Connected path also emits onConnectionState/onError; avoid double work.
            refreshDevices({silent: true}).catch(() => undefined);
            return;
          }
          setErrorMessage(null);
        }
        if (reason === 'attached') {
          autoConnectAttemptRef.current = null;
          setErrorMessage(null);
        }
        refreshDevices({silent: true}).catch(() => undefined);
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
      unsubscribeDevicesChanged();
      unsubscribeFlash();
      if (historyFlushRafRef.current != null) {
        cancelAnimationFrame(historyFlushRafRef.current);
      }
      if (throughputFlushTimerRef.current != null) {
        clearTimeout(throughputFlushTimerRef.current);
      }
    };
  }, [
    appendSerialLog,
    client,
    handleSessionLost,
    recordScan,
    refreshDevices,
    serialAvailable,
  ]);

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
