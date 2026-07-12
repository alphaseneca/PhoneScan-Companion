import {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {ScanResult} from '@alphaseneca/react-native-phonescan';

interface ScanDisplayProps {
  latestScan: ScanResult | null;
}

function formatInstant(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function ScanDisplayComponent({latestScan}: ScanDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Latest scan</Text>
        {latestScan ? <View style={styles.liveDot} /> : null}
      </View>
      <Text selectable style={styles.value}>
        {latestScan?.value ?? 'Waiting for scan…'}
      </Text>
      {latestScan ? (
        <Text style={styles.meta}>
          {latestScan.length} chars · {formatInstant(latestScan.timestamp)}
        </Text>
      ) : null}
    </View>
  );
}

export const ScanDisplay = memo(ScanDisplayComponent);

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: '#111827',
    padding: 20,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  value: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  meta: {
    color: '#D1D5DB',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
