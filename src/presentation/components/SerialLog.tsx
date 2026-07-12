import {Pressable, StyleSheet, Text, View} from 'react-native';

import {
  parsePhoneScanStatus,
  type PhoneScanStatus,
} from '@alphaseneca/react-native-phonescan';

interface SerialLogProps {
  lines: string[];
  deviceStatus: PhoneScanStatus | null;
  lastScanSignalAt: number | null;
  onClear: () => void;
}

type LogKind = 'status' | 'signal' | 'ack' | 'help' | 'raw';

interface ParsedLogLine {
  kind: LogKind;
  label: string;
  summary: string;
  raw: string;
}

const KIND_STYLE: Record<
  LogKind,
  {badge: string; badgeText: string; row: string}
> = {
  status: {
    badge: '#CCFBF1',
    badgeText: '#0F766E',
    row: '#F0FDFA',
  },
  signal: {
    badge: '#DBEAFE',
    badgeText: '#1D4ED8',
    row: '#EFF6FF',
  },
  ack: {
    badge: '#DCFCE7',
    badgeText: '#15803D',
    row: '#F0FDF4',
  },
  help: {
    badge: '#EDE9FE',
    badgeText: '#6D28D9',
    row: '#F5F3FF',
  },
  raw: {
    badge: '#E2E8F0',
    badgeText: '#475569',
    row: '#FFFFFF',
  },
};

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function classifyLine(line: string): ParsedLogLine {
  const raw = line.trim();
  if (!raw) {
    return {kind: 'raw', label: 'Empty', summary: '(blank line)', raw: line};
  }

  if (/\[\s*scan\s*\]/i.test(raw)) {
    return {
      kind: 'signal',
      label: 'Scan',
      summary: 'Scanner triggered a read',
      raw,
    };
  }

  const status = parsePhoneScanStatus(raw);
  if (status) {
    return {
      kind: 'status',
      label: 'Status',
      summary: `${status.mode} mode · ${status.sleeping ? 'sleeping' : 'awake'}`,
      raw,
    };
  }

  if (/^(ok|done|ready)\b/i.test(raw)) {
    return {
      kind: 'ack',
      label: 'OK',
      summary: 'Command accepted',
      raw,
    };
  }

  if (/error|fail|denied|unknown/i.test(raw)) {
    return {
      kind: 'raw',
      label: 'Error',
      summary: raw,
      raw,
    };
  }

  if (/help|commands?/i.test(raw)) {
    return {
      kind: 'help',
      label: 'Help',
      summary: 'Available commands from device',
      raw,
    };
  }

  // Mode-change style one-liners, e.g. "Manual" / "Sense"
  if (/^(manual|sense|continuous|next|sleep|wake)$/i.test(raw)) {
    return {
      kind: 'ack',
      label: 'Mode',
      summary: `Switched to ${raw}`,
      raw,
    };
  }

  return {
    kind: 'raw',
    label: 'Reply',
    summary: raw,
    raw,
  };
}

function StatusChips({
  deviceStatus,
  lastScanSignalAt,
}: {
  deviceStatus: PhoneScanStatus | null;
  lastScanSignalAt: number | null;
}) {
  if (!deviceStatus && !lastScanSignalAt) {
    return null;
  }

  return (
    <View style={styles.chips}>
      {deviceStatus ? (
        <>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Mode</Text>
            <Text style={styles.chipValue}>{deviceStatus.mode}</Text>
          </View>
          <View
            style={[
              styles.chip,
              deviceStatus.sleeping ? styles.chipWarn : styles.chipOk,
            ]}>
            <Text style={styles.chipLabel}>Power</Text>
            <Text style={styles.chipValue}>
              {deviceStatus.sleeping ? 'Sleeping' : 'Awake'}
            </Text>
          </View>
        </>
      ) : null}
      {lastScanSignalAt ? (
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Last trigger</Text>
          <Text style={styles.chipValue}>{formatClock(lastScanSignalAt)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LogEntry({line}: {line: string}) {
  const parsed = classifyLine(line);
  const colors = KIND_STYLE[parsed.kind];
  const showRaw = parsed.summary !== parsed.raw;

  return (
    <View style={[styles.entry, {backgroundColor: colors.row}]}>
      <View style={styles.entryHeader}>
        <View style={[styles.badge, {backgroundColor: colors.badge}]}>
          <Text style={[styles.badgeText, {color: colors.badgeText}]}>
            {parsed.label}
          </Text>
        </View>
        <Text selectable style={styles.summary}>
          {parsed.summary}
        </Text>
      </View>
      {showRaw ? (
        <Text selectable style={styles.raw}>
          {parsed.raw}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Serial replies from PhoneScan, shown as classified cards (status / scan / ack / raw)
 * plus chips for the last known mode and power state.
 */
export function SerialLog({
  lines,
  deviceStatus,
  lastScanSignalAt,
  onClear,
}: SerialLogProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Device log</Text>
          <Text style={styles.subtitle}>
            Replies from PhoneScan after each command
          </Text>
        </View>
        {lines.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <StatusChips
        deviceStatus={deviceStatus}
        lastScanSignalAt={lastScanSignalAt}
      />

      {lines.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>
            Connect, then tap Status or another command. Responses show up here
            with a plain-English summary.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {lines.map((line, index) => (
            <LogEntry key={`${index}-${line}`} line={line} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  clear: {
    color: '#DC2626',
    fontWeight: '600',
    paddingTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 96,
    gap: 2,
  },
  chipOk: {
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
  },
  chipWarn: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  list: {
    gap: 8,
  },
  entry: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  summary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
  },
  raw: {
    marginLeft: 2,
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
    lineHeight: 17,
  },
});
