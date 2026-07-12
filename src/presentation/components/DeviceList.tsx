import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {UsbDeviceInfo} from '@alphaseneca/react-native-phonescan';

interface DeviceListProps {
  devices: UsbDeviceInfo[];
  selectedDeviceId: number | null;
  isRefreshing: boolean;
  onSelect: (deviceId: number) => void;
  onRefresh: () => void;
}

export function DeviceList({
  devices,
  selectedDeviceId,
  isRefreshing,
  onSelect,
  onRefresh,
}: DeviceListProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Devices</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#0F766E" />
          ) : (
            <Text style={styles.refreshText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {devices.length === 0 ? (
        <Text style={styles.empty}>No USB devices. Plug in PhoneScan and refresh.</Text>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => String(item.deviceId)}
          scrollEnabled={false}
          renderItem={({item}) => {
            const selected = item.deviceId === selectedDeviceId;
            return (
              <Pressable
                onPress={() => onSelect(item.deviceId)}
                style={[styles.item, selected && styles.itemSelected]}>
                <Text style={styles.itemTitle}>
                  {item.isPhoneScan ? 'PhoneScan' : item.deviceName}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.vendorId.toString(16).toUpperCase()}:
                  {item.productId.toString(16).toUpperCase()}
                  {item.hasPermission ? '' : ' · permission needed'}
                </Text>
              </Pressable>
            );
          }}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    color: '#0F766E',
    fontWeight: '600',
  },
  empty: {
    color: '#64748B',
    lineHeight: 20,
  },
  item: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  itemSelected: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
});
