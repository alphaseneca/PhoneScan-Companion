import {memo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {ScanResult} from '@alphaseneca/react-native-phonescan';

interface ScanHistoryProps {
  history: ScanResult[];
  onClear: () => void;
}

function formatInstant(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function ScanHistoryComponent({history, onClear}: ScanHistoryProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable onPress={onClear}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>

      {history.length === 0 ? (
        <Text style={styles.empty}>Scans will appear here.</Text>
      ) : (
        <View style={styles.list}>
          {history.slice(0, 30).map(item => (
            <View key={item.id} style={styles.row}>
              <Text selectable style={styles.value}>
                {item.value}
              </Text>
              <Text style={styles.meta}>
                {item.length} chars · {formatInstant(item.timestamp)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const ScanHistory = memo(ScanHistoryComponent);

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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  clear: {
    color: '#DC2626',
    fontWeight: '600',
  },
  empty: {
    color: '#6B7280',
  },
  list: {
    gap: 0,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
    gap: 4,
  },
  value: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    color: '#6B7280',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
