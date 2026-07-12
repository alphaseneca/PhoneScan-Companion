import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {PhoneScanStatus} from '@alphaseneca/react-native-phonescan';

interface SerialLogProps {
  lines: string[];
  deviceStatus: PhoneScanStatus | null;
  lastScanSignalAt: number | null;
  onClear: () => void;
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Minimal device serial log — raw replies plus a one-line status summary.
 */
export function SerialLog({
  lines,
  deviceStatus,
  lastScanSignalAt,
  onClear,
}: SerialLogProps) {
  const statusBits: string[] = [];
  if (deviceStatus) {
    statusBits.push(deviceStatus.mode);
    statusBits.push(deviceStatus.sleeping ? 'sleeping' : 'awake');
  }
  if (lastScanSignalAt) {
    statusBits.push(`last scan ${formatClock(lastScanSignalAt)}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        {lines.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {statusBits.length > 0 ? (
        <Text style={styles.status}>{statusBits.join(' · ')}</Text>
      ) : null}

      {lines.length === 0 ? (
        <Text style={styles.empty}>Logs will show up here.</Text>
      ) : (
        <View style={styles.list}>
          {lines.map((line, index) => (
            <Text
              key={`${index}-${line}`}
              selectable
              style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  clear: {
    color: '#DC2626',
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    color: '#64748B',
  },
  empty: {
    color: '#64748B',
    fontSize: 14,
  },
  list: {
    gap: 6,
  },
  line: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
