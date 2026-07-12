import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

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

/**
 * Activity screen: device log and scan history.
 * Keeps the home screen focused on live scanning and connection.
 */
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
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Activity</Text>
        <View style={styles.headerSpacer} />
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 4,
    minWidth: 72,
  },
  backText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSpacer: {
    minWidth: 72,
  },
});
