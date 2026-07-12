import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /**
   * False until the first load from storage finishes.
   * Gate auto-connect and settings writes on this so defaults do not race disk.
   */
  ready: boolean;
  setAutoConnect: (enabled: boolean) => void;
  /** Merge partial updates for future preference keys without new setters. */
  updateSettings: (partial: Partial<CompanionSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function persistSettings(next: CompanionSettings): void {
  saveCompanionSettings(next).catch(() => undefined);
}

/**
 * Loads and persists Companion preferences for the host app.
 * Library code never touches storage; only this provider does.
 */
export function SettingsProvider({children}: {children: ReactNode}) {
  const [settings, setSettings] = useState<CompanionSettings>(
    () => ({...DEFAULT_COMPANION_SETTINGS}),
  );
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadCompanionSettings()
      .then(loaded => {
        if (cancelled) {
          return;
        }
        readyRef.current = true;
        setSettings(loaded);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        readyRef.current = true;
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setAutoConnect = useCallback((enabled: boolean) => {
    if (!readyRef.current) {
      return;
    }
    setSettings(previous => {
      const next = {...previous, autoConnect: enabled};
      persistSettings(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<CompanionSettings>) => {
    if (!readyRef.current) {
      return;
    }
    setSettings(previous => {
      const next = {...previous, ...partial};
      persistSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    (): SettingsContextValue => ({
      settings,
      ready,
      setAutoConnect,
      updateSettings,
    }),
    [ready, setAutoConnect, settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useCompanionSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (ctx == null) {
    throw new Error('useCompanionSettings must be used within SettingsProvider');
  }
  return ctx;
}
