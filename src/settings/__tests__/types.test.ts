import {
  DEFAULT_COMPANION_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from '../types';

describe('Companion settings defaults', () => {
  it('enables auto-connect by default', () => {
    expect(DEFAULT_COMPANION_SETTINGS).toEqual({autoConnect: true});
  });

  it('uses a versioned storage key for forward-compatible migrations', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('phonescan.companion.settings.v1');
  });
});
