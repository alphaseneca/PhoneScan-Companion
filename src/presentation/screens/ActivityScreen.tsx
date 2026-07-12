import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';

import type {
  PhoneScanStatus,
  ScanResult,
} from '@alphaseneca/react-native-phonescan';
import {ScanHistory} from '../components/ScanHistory';
import {SerialLog} from '../components/SerialLog';

interface ActivityScreenProps {
  serialLog: string[];
  deviceStatus: PhoneScanStatus | null;
  lastScanSignalAt: number | null;
  scanHistory: ScanResult[];
  onClearLog: () => void;
  onClearHistory: () => void;
  onBack: () => void;
}

/** Activity: log + history only. */
export function ActivityScreen({
  serialLog,
  deviceStatus,
  lastScanSignalAt,
  scanHistory,
  onClearLog,
  onClearHistory,
  onBack,
}: ActivityScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <SerialLog
        lines={serialLog}
        deviceStatus={deviceStatus}
        lastScanSignalAt={lastScanSignalAt}
        onClear={onClearLog}
      />

      <ScanHistory history={scanHistory} onClear={onClearHistory} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 16,
  },
});
