/**
 * Known PhoneScan CDC-ACM control commands (case-insensitive per spec).
 * Extend this object when firmware adds named commands; until then, any raw
 * command string can be sent via `sendCommand` / `sendPhoneScanCommand`.
 */
export const PHONESCAN_COMMANDS = {
  next: 'next',
  manual: 'manual',
  sense: 'sense',
  continuous: 'continuous',
  mode: 'mode',
  status: 'status',
  sleep: 'sleep',
  wake: 'wake',
  trig: 'trig',
  bootloader: 'bootloader',
  debugmode: 'debugmode',
  help: 'help',
  // Future firmware commands: add keys here (additive, non-breaking).
} as const;

/** Known command literals; pass any string to send unknown/future firmware cmds. */
export type PhoneScanCommand =
  | (typeof PHONESCAN_COMMANDS)[keyof typeof PHONESCAN_COMMANDS]
  | (string & {});

export type PhoneScanScanMode = 'Manual' | 'Sense' | 'Continuous' | 'Unknown';

export interface PhoneScanStatus {
  mode: PhoneScanScanMode;
  sleeping: boolean;
  raw: string;
}

const MODE_LINE = /mode\s*:\s*(Manual|Sense|Continuous)/i;
const SLEEP_LINE = /sleeping\s*:\s*(yes|no)/i;

export function parsePhoneScanStatus(response: string): PhoneScanStatus | null {
  const modeMatch = response.match(MODE_LINE);
  const sleepMatch = response.match(SLEEP_LINE);

  if (!modeMatch && !sleepMatch) {
    return null;
  }

  const modeText = modeMatch?.[1];
  const mode: PhoneScanScanMode =
    modeText === 'Manual' || modeText === 'Sense' || modeText === 'Continuous'
      ? modeText
      : 'Unknown';

  return {
    mode,
    sleeping: sleepMatch?.[1]?.toLowerCase() === 'yes',
    raw: response,
  };
}

export function isPhoneScanDevice(vendorId: number, productId: number): boolean {
  return vendorId === 0x1209 && productId === 0xc55c;
}
