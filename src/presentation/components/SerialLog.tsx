import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {PhoneScanStatus} from '@alphaseneca/react-native-phonescan';

interface SerialLogProps {
  lines: string[];
  deviceStatus: PhoneScanStatus | null;
  lastScanSignalAt: number | null;
  onClear: () => void;
}

export function SerialLog({
  lines,
  deviceStatus,
  lastScanSignalAt,
  onClear,
}: SerialLogProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        <Pressable onPress={onClear}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>

      {deviceStatus ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusLine}>Mode: {deviceStatus.mode}</Text>
          <Text style={styles.statusLine}>
            Sleeping: {deviceStatus.sleeping ? 'yes' : 'no'}
          </Text>
        </View>
      ) : null}

      {lastScanSignalAt ? (
        <Text style={styles.signal}>
          Last [ scan ] signal: {new Date(lastScanSignalAt).toLocaleTimeString()}
        </Text>
      ) : null}

      {lines.length === 0 ? (
        <Text style={styles.empty}>Command responses appear here.</Text>
      ) : (
        <ScrollView style={styles.log} nestedScrollEnabled>
          {lines.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.line}>
              {line}
            </Text>
          ))}
        </ScrollView>
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
    color: '#111827',
  },
  clear: {
    color: '#DC2626',
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  statusLine: {
    color: '#065F46',
    fontWeight: '600',
  },
  signal: {
    fontSize: 12,
    color: '#6B7280',
  },
  empty: {
    color: '#6B7280',
    fontSize: 13,
  },
  log: {
    maxHeight: 140,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 10,
  },
  line: {
    color: '#E5E7EB',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
