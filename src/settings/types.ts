/**
 * App-level settings for PhoneScan Companion.
 *
 * First principles:
 * - The library talks to hardware (USB / flash). Preferences that shape *app
 *   behavior* (auto-connect, future UI toggles) live here so host apps can
 *   persist and extend them without forking the native module.
 * - Add new keys as optional fields with defaults — never remove a key without
 *   a migration. Consumers read via SettingsProvider.
 */

export interface CompanionSettings {
  /** When true, connect automatically once a PhoneScan (or CDC) device appears. */
  autoConnect: boolean;

  /**
   * Stubs for later preferences — keep the shape stable so UI toggles can
   * land without redesigning storage.
   */
  // keepScreenOnWhileConnected?: boolean;
  // playSoundOnScan?: boolean;
  // preferPhoneScanOnly?: boolean;
  // defaultBaudRate?: number;
}

export const DEFAULT_COMPANION_SETTINGS: CompanionSettings = {
  autoConnect: true,
};

export const SETTINGS_STORAGE_KEY = 'phonescan.companion.settings.v1';
