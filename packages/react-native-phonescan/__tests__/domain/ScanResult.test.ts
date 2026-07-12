import {createScanResult} from '../../src/domain/entities/ScanResult';

describe('createScanResult', () => {
  it('builds a serial scan entity with length and stable id', () => {
    const scan = createScanResult('ABC123', 1_700_000_000_000);
    expect(scan).toEqual({
      id: '1700000000000-ABC123',
      value: 'ABC123',
      timestamp: 1_700_000_000_000,
      length: 6,
      source: 'serial',
    });
  });

  it('allows an explicit source override', () => {
    expect(createScanResult('X', 1, 'serial').source).toBe('serial');
  });
});
