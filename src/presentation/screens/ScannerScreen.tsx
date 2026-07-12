import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {BAUD_RATE_OPTIONS} from '@alphaseneca/react-native-phonescan';
import {appContainer} from '../../core/di/container';
import {useCompanionSettings} from '../../settings/SettingsProvider';
import {ConnectionStatus} from '../components/ConnectionStatus';
import {DeviceList} from '../components/DeviceList';
import {FirmwareUpdatePanel} from '../components/FirmwareUpdatePanel';
import {PhoneScanControlPanel} from '../components/PhoneScanControlPanel';
import {ScanDisplay} from '../components/ScanDisplay';
import {ScanHistory} from '../components/ScanHistory';
import {SerialLog} from '../components/SerialLog';
import {SettingsPanel} from '../components/SettingsPanel';
import {useScannerScreen} from '../hooks/useScannerScreen';

/**
 * PhoneScan Companion home screen.
 * Shows live scans, connection, firmware flash (.bin/.hex), and settings.
 */
export function ScannerScreen() {
  const {settings, setAutoConnect} = useCompanionSettings();
  const {
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
    selectDevice,
    setBaudRate,
    connect,
    disconnect,
    clearHistory,
    sendCommand,
    clearSerialLog,
    pickFirmware,
    clearFirmware,
    flashFirmware,
  } = useScannerScreen(appContainer, {autoConnect: settings.autoConnect});

  const isSerialConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const flashBusy = flashStatus === 'flashing' || flashStatus === 'picking';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/phonescan-logo.png')}
          style={styles.logo}
          accessibilityLabel="PhoneScan Companion"
        />
        <View style={styles.heroText}>
          <Text style={styles.brand}>PhoneScan Companion</Text>
          <Text style={styles.tagline}>Scan · Control · Flash</Text>
        </View>
      </View>

      <ConnectionStatus
        status={status}
        scansPerSecond={scansPerSecond}
        charsPerSecond={charsPerSecond}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <ScanDisplay latestScan={latestScan} />

      {serialAvailable ? (
        <>
          <SettingsPanel
            settings={settings}
            onAutoConnectChange={setAutoConnect}
          />

          <DeviceList
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            isRefreshing={isRefreshing}
            onSelect={selectDevice}
            onRefresh={refreshDevices}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Baud</Text>
            <View style={styles.baudRow}>
              {BAUD_RATE_OPTIONS.map(rate => {
                const selected = rate === baudRate;
                return (
                  <Pressable
                    key={rate}
                    disabled={isSerialConnected || isConnecting || flashBusy}
                    onPress={() => setBaudRate(rate)}
                    style={[styles.baudChip, selected && styles.baudChipSelected]}>
                    <Text
                      style={[
                        styles.baudChipText,
                        selected && styles.baudChipTextSelected,
                      ]}>
                      {rate}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              disabled={
                isSerialConnected ||
                isConnecting ||
                selectedDeviceId == null ||
                flashBusy
              }
              onPress={connect}
              style={[
                styles.button,
                styles.connectButton,
                (isSerialConnected ||
                  isConnecting ||
                  selectedDeviceId == null ||
                  flashBusy) &&
                  styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>
                {isConnecting ? 'Connecting…' : 'Connect'}
              </Text>
            </Pressable>

            <Pressable
              disabled={(!isSerialConnected && !isConnecting) || flashBusy}
              onPress={disconnect}
              style={[
                styles.button,
                styles.disconnectButton,
                ((!isSerialConnected && !isConnecting) || flashBusy) &&
                  styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>Disconnect</Text>
            </Pressable>
          </View>

          <PhoneScanControlPanel
            disabled={!isSerialConnected || flashBusy}
            onCommand={sendCommand}
          />

          <FirmwareUpdatePanel
            disabled={flashBusy}
            firmwareFile={firmwareFile}
            flashStatus={flashStatus}
            flashProgress={flashProgress}
            flashMessage={flashMessage}
            onPick={pickFirmware}
            onClear={clearFirmware}
            onFlash={flashFirmware}
          />

          <SerialLog
            lines={serialLog}
            deviceStatus={deviceStatus}
            lastScanSignalAt={lastScanSignalAt}
            onClear={clearSerialLog}
          />
        </>
      ) : (
        <View style={styles.iosNote}>
          <Text style={styles.iosNoteTitle}>Android required</Text>
          <Text style={styles.iosNoteBody}>
            PhoneScan Companion needs USB OTG on Android.
          </Text>
        </View>
      )}

      <ScanHistory history={scanHistory} onClear={clearHistory} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  baudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  baudChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  baudChipSelected: {
    borderColor: '#0D9488',
    backgroundColor: '#CCFBF1',
  },
  baudChipText: {
    color: '#475569',
    fontWeight: '600',
  },
  baudChipTextSelected: {
    color: '#0F766E',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#0F766E',
  },
  disconnectButton: {
    backgroundColor: '#64748B',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  iosNote: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  iosNoteTitle: {
    fontWeight: '700',
    color: '#92400E',
  },
  iosNoteBody: {
    color: '#78350F',
    lineHeight: 20,
    fontSize: 14,
  },
  error: {
    color: '#DC2626',
    fontWeight: '600',
  },
});
