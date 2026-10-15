import { describe, expect, it } from 'vitest';
import { absoluteUrl, formatBytes, normaliseSender, previewKind, totalsMismatch } from './documents.util';

describe('documents helpers', () => {
  it('flags HT + TVA that does not match TTC', () => {
    expect(totalsMismatch(1000, 200, 1200)).toBe(false);
    expect(totalsMismatch(1000, 200, 1250)).toBe(true);
    expect(totalsMismatch('1000,50', '200.10', 1200.6)).toBe(false);
  });

  it('tolerates a one-cent rounding difference and missing amounts', () => {
    expect(totalsMismatch(833.33, 166.67, 1000.01)).toBe(false);
    expect(totalsMismatch(null, 200, 1200)).toBe(false);
    expect(totalsMismatch(1000, '', 1200)).toBe(false);
  });

  it('accepts addresses and @domains as trusted senders', () => {
    expect(normaliseSender(' Billing@Acme.ma ')).toBe('billing@acme.ma');
    expect(normaliseSender('@acme.ma')).toBe('@acme.ma');
    expect(normaliseSender('acme')).toBeNull();
    expect(normaliseSender('@acme')).toBeNull();
  });

  it('formats sizes, links and preview kinds', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(0)).toBe('—');
    expect(absoluteUrl('/f/abc', 'https://app.bento.ma/')).toBe('https://app.bento.ma/f/abc');
    expect(absoluteUrl('https://x.ma/f/abc', 'https://app.bento.ma')).toBe('https://x.ma/f/abc');
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('text/csv')).toBeNull();
  });
});
