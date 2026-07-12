import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {loadCompanionSettings, saveCompanionSettings} from './storage';
import {
  DEFAULT_COMPANION_SETTINGS,
  type CompanionSettings,
} from './types';

interface SettingsContextValue {
  settings: CompanionSettings;
  ready: boolean;
  setAutoConnect: (enabled: boolean) => void;
  /** Merge partial updates for future preference keys without new setters. */
  updateSettings: (partial: Partial<CompanionSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: ReactNode}) {
  const [settings, setSettings] = useState<CompanionSettings>({
    ...DEFAULT_COMPANION_SETTINGS,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCompanionSettings()
      .then(loaded => {
        if (!cancelled) {
          setSettings(loaded);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: CompanionSettings) => {
    setSettings(next);
    saveCompanionSettings(next).catch(() => undefined);
  }, []);

  const setAutoConnect = useCallback(
    (enabled: boolean) => {
      persist({...settings, autoConnect: enabled});
    },
    [persist, settings],
  );

  const updateSettings = useCallback(
    (partial: Partial<CompanionSettings>) => {
      persist({...settings, ...partial});
    },
    [persist, settings],
  );

  const value = useMemo(
    () => ({settings, ready, setAutoConnect, updateSettings}),
    [ready, setAutoConnect, settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useCompanionSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useCompanionSettings must be used within SettingsProvider');
  }
  return ctx;
}
