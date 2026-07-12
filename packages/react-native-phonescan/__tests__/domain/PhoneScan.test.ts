import {
  PHONESCAN_COMMANDS,
  isPhoneScanDevice,
  parsePhoneScanStatus,
} from '../../src/domain/entities/PhoneScan';

describe('isPhoneScanDevice', () => {
  it('matches only PhoneScan VID/PID', () => {
    expect(isPhoneScanDevice(0x1209, 0xc55c)).toBe(true);
    expect(isPhoneScanDevice(4617, 50524)).toBe(true);
  });

  it('rejects bootloader and unrelated devices', () => {
    expect(isPhoneScanDevice(0x4348, 0x55e0)).toBe(false);
    expect(isPhoneScanDevice(0x1209, 0x0000)).toBe(false);
    expect(isPhoneScanDevice(0, 0)).toBe(false);
  });
});

describe('parsePhoneScanStatus', () => {
  const sample = `
+----------------------------+
| mode 	: Continuous
| sleeping : no
+----------------------------+
`;

  it('parses mode and sleep from a status block', () => {
    const parsed = parsePhoneScanStatus(sample);
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe('Continuous');
    expect(parsed?.sleeping).toBe(false);
    expect(parsed?.raw).toBe(sample);
  });

  it('detects sleeping yes', () => {
    const parsed = parsePhoneScanStatus('mode: Manual\nsleeping: yes');
    expect(parsed?.mode).toBe('Manual');
    expect(parsed?.sleeping).toBe(true);
  });

  it('accepts Sense mode', () => {
    expect(parsePhoneScanStatus('mode : Sense')?.mode).toBe('Sense');
  });

  it('returns null when neither mode nor sleep is present', () => {
    expect(parsePhoneScanStatus('hello world')).toBeNull();
    expect(parsePhoneScanStatus('')).toBeNull();
  });

  it('returns Unknown mode when the label is not a known scan mode', () => {
    const parsed = parsePhoneScanStatus('mode: Weird\nsleeping: no');
    // Regex only captures Manual|Sense|Continuous — Weird yields no modeMatch alone…
    // Combined with sleep, modeMatch fails so mode becomes Unknown only if modeMatch exists.
    // 'mode: Weird' does not match MODE_LINE → only sleepMatch → mode Unknown.
    expect(parsed?.mode).toBe('Unknown');
    expect(parsed?.sleeping).toBe(false);
  });
});

describe('PHONESCAN_COMMANDS', () => {
  it('includes bootloader and status for flash / health flows', () => {
    expect(PHONESCAN_COMMANDS.bootloader).toBe('bootloader');
    expect(PHONESCAN_COMMANDS.status).toBe('status');
    expect(PHONESCAN_COMMANDS.trig).toBe('trig');
  });
});
