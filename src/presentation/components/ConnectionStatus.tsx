import {StyleSheet, Text, View} from 'react-native';

interface ConnectionStatusProps {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  scansPerSecond: number;
  charsPerSecond: number;
}

const STATUS_LABELS = {
  idle: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
} as const;

const STATUS_COLORS = {
  idle: '#94A3B8',
  connecting: '#D97706',
  connected: '#0D9488',
  error: '#DC2626',
} as const;

export function ConnectionStatus({
  status,
  scansPerSecond,
  charsPerSecond,
}: ConnectionStatusProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, {backgroundColor: STATUS_COLORS[status]}]} />
      <Text style={styles.label}>{STATUS_LABELS[status]}</Text>
      <Text style={styles.metric}>
        {scansPerSecond}/s · {charsPerSecond} ch/s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  metric: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
});
