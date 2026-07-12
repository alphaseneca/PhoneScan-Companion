import {NativeModules, Platform} from 'react-native';

import {
  DEFAULT_COMPANION_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type CompanionSettings,
} from './types';

type PrefsNative = {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
};

const prefs = (NativeModules as {CompanionPreferences?: PrefsNative})
  .CompanionPreferences;

function mergeSettings(partial: Partial<CompanionSettings>): CompanionSettings {
  return {
    ...DEFAULT_COMPANION_SETTINGS,
    ...partial,
  };
}

/**
 * Load Companion settings from Android SharedPreferences.
 * Falls back to defaults on iOS or if the native module is missing.
 */
export async function loadCompanionSettings(): Promise<CompanionSettings> {
  if (Platform.OS !== 'android' || !prefs) {
    return {...DEFAULT_COMPANION_SETTINGS};
  }

  try {
    const raw = await prefs.getString(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {...DEFAULT_COMPANION_SETTINGS};
    }
    const parsed = JSON.parse(raw) as Partial<CompanionSettings>;
    return mergeSettings(parsed);
  } catch {
    return {...DEFAULT_COMPANION_SETTINGS};
  }
}

export async function saveCompanionSettings(
  settings: CompanionSettings,
): Promise<void> {
  if (Platform.OS !== 'android' || !prefs) {
    return;
  }
  await prefs.setString(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
