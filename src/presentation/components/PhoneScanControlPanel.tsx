import {Pressable, StyleSheet, Text, View} from 'react-native';

import {type PhoneScanCommand} from '@alphaseneca/react-native-phonescan';

interface PhoneScanControlPanelProps {
  disabled: boolean;
  onCommand: (command: PhoneScanCommand) => void;
}

const COMMAND_GROUPS: Array<{title: string; commands: PhoneScanCommand[]}> = [
  {
    title: 'Mode',
    commands: ['manual', 'sense', 'continuous', 'next'],
  },
  {
    title: 'Control',
    commands: ['status', 'trig', 'sleep', 'wake'],
  },
];

export function PhoneScanControlPanel({
  disabled,
  onCommand,
}: PhoneScanControlPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Commands</Text>

      {COMMAND_GROUPS.map(group => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.row}>
            {group.commands.map(command => (
              <Pressable
                key={command}
                disabled={disabled}
                onPress={() => onCommand(command)}
                style={[styles.chip, disabled && styles.chipDisabled]}>
                <Text style={styles.chipText}>{command}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 13,
  },
});
