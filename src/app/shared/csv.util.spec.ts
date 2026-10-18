import { describe, expect, it } from 'vitest';
import { csvCell } from './csv.util';

describe('csvCell', () => {
  it('quotes and doubles quotes', () => {
    expect(csvCell('Atlas "SARL"')).toBe('"Atlas ""SARL"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12.5)).toBe('"12.5"');
  });

  it('keeps formulas from running in a spreadsheet', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csvCell('+212600000000')).toBe('"\'+212600000000"');
    expect(csvCell('-5')).toBe('"\'-5"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('VIR RECU')).toBe('"VIR RECU"');
    expect(csvCell(-5)).toBe('"-5"');
  });
});
