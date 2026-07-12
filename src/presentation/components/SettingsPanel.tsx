import {StyleSheet, Switch, Text, View} from 'react-native';

import type {CompanionSettings} from '../../settings/types';

interface SettingsPanelProps {
  settings: CompanionSettings;
  onAutoConnectChange: (enabled: boolean) => void;
}

/**
 * Companion settings surface.
 * Today: auto-connect. Tomorrow: add rows here bound to CompanionSettings stubs.
 */
export function SettingsPanel({
  settings,
  onAutoConnectChange,
}: SettingsPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.label}>Auto-connect</Text>
          <Text style={styles.hint}>Connect when a device is detected</Text>
        </View>
        <Switch
          value={settings.autoConnect}
          onValueChange={onAutoConnectChange}
          trackColor={{false: '#CBD5E1', true: '#5EEAD4'}}
          thumbColor={settings.autoConnect ? '#0F766E' : '#F8FAFC'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
  },
});
