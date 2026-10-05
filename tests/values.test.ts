import { describe, expect, it } from 'vitest';
import { parsePercent, parseStartMonth, versionText } from '../src/shared/values';

describe('parsePercent', () => {
  it('reads a fraction, a number and a "40%" text as 40', () => {
    expect(parsePercent(0.4)).toBe(40);
    expect(parsePercent(40)).toBe(40);
    expect(parsePercent('40%')).toBe(40);
    expect(parsePercent('40')).toBe(40);
    expect(parsePercent(0)).toBe(0);
    expect(parsePercent(1)).toBe(100);
  });

  it('reads blank as null', () => {
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('  ')).toBeNull();
  });

  it('rejects values outside 0–100 and text', () => {
    expect(parsePercent(150)).toBe('invalid');
    expect(parsePercent('150%')).toBe('invalid');
    expect(parsePercent(-5)).toBe('invalid');
    expect(parsePercent('half')).toBe('invalid');
  });
});

describe('parseStartMonth', () => {
  const oct2026 = { startYear: 2026, startMonth: 10 };

  it('reads an Excel date serial, a Date and text forms', () => {
    expect(parseStartMonth(46296)).toEqual(oct2026); // 2026-10-01
    expect(parseStartMonth(new Date(2026, 9, 1))).toEqual(oct2026);
    expect(parseStartMonth('Oct 2026')).toEqual(oct2026);
    expect(parseStartMonth('October 2026')).toEqual(oct2026);
    expect(parseStartMonth('2026-10-01')).toEqual(oct2026);
  });

  it('returns null for anything else', () => {
    expect(parseStartMonth(null)).toBeNull();
    expect(parseStartMonth('')).toBeNull();
    expect(parseStartMonth(12)).toBeNull();
    expect(parseStartMonth('FY2026-27')).toBeNull();
    expect(parseStartMonth('2026-13-01')).toBeNull();
  });
});

describe('versionText', () => {
  it('takes the leading x.y of "4.2 (01/10/2026)"', () => {
    expect(versionText('4.2 (01/10/2026)')).toBe('4.2');
  });

  it('keeps today’s results for "2.0" and the number 2', () => {
    expect(versionText('2.0')).toBe('2.0');
    expect(versionText(2)).toBe('2.0');
    expect(versionText(2.1)).toBe('2.1');
    expect(versionText('')).toBeNull();
  });
});
