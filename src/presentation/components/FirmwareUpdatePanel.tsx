import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import type {
  FirmwareFilePayload,
  FlashProgressPayload,
} from '@alphaseneca/react-native-phonescan';

type FlashStatus = 'idle' | 'picking' | 'flashing' | 'success' | 'error';

interface FirmwareUpdatePanelProps {
  disabled: boolean;
  firmwareFile: FirmwareFilePayload | null;
  flashStatus: FlashStatus;
  flashProgress: FlashProgressPayload | null;
  flashMessage: string | null;
  onPick: () => void;
  onClear: () => void;
  onFlash: () => void;
}

export function FirmwareUpdatePanel({
  disabled,
  firmwareFile,
  flashStatus,
  flashProgress,
  flashMessage,
  onPick,
  onClear,
  onFlash,
}: FirmwareUpdatePanelProps) {
  const busy = flashStatus === 'picking' || flashStatus === 'flashing';
  const progressRatio =
    flashProgress && flashProgress.total > 0
      ? Math.min(1, flashProgress.current / flashProgress.total)
      : flashStatus === 'success'
        ? 1
        : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firmware</Text>

      <View style={styles.fileRow}>
        <Pressable
          disabled={busy}
          onPress={onPick}
          style={[styles.secondaryButton, busy && styles.disabled]}>
          {flashStatus === 'picking' ? (
            <ActivityIndicator color="#0F766E" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {firmwareFile ? 'Change file' : 'Select .bin / .hex'}
            </Text>
          )}
        </Pressable>
        {firmwareFile ? (
          <Pressable disabled={busy} onPress={onClear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {firmwareFile ? (
        <Text style={styles.fileMeta} numberOfLines={1}>
          {firmwareFile.name} · {(firmwareFile.size / 1024).toFixed(1)} KB
        </Text>
      ) : null}

      {flashStatus === 'flashing' || flashStatus === 'success' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {flex: progressRatio}]} />
          <View style={{flex: Math.max(0.001, 1 - progressRatio)}} />
        </View>
      ) : null}

      {flashMessage ? (
        <Text
          style={[
            styles.message,
            flashStatus === 'error' && styles.messageError,
            flashStatus === 'success' && styles.messageSuccess,
          ]}>
          {flashMessage}
        </Text>
      ) : (
        <Text style={styles.hint}>Connect, then flash within ~5s of reboot.</Text>
      )}

      <Pressable
        disabled={disabled || busy || !firmwareFile}
        onPress={onFlash}
        style={[
          styles.flashButton,
          (disabled || busy || !firmwareFile) && styles.disabled,
        ]}>
        {flashStatus === 'flashing' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.flashButtonText}>Update firmware</Text>
        )}
      </Pressable>
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
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 14,
  },
  clearText: {
    color: '#64748B',
    fontWeight: '600',
  },
  fileMeta: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0D9488',
    borderRadius: 3,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
  },
  message: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  messageError: {
    color: '#DC2626',
  },
  messageSuccess: {
    color: '#047857',
  },
  flashButton: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  flashButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
});
