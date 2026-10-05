import { describe, expect, it } from 'vitest';
import { normWord, suggestDue, suggestQuarter, suggestStatus } from '../src/shared/suggest';

describe('suggestions for unknown words', () => {
  it('normalizes words', () => {
    expect(normWord('  In   Progress ')).toBe('in progress');
  });

  it('suggests status tones', () => {
    expect(suggestStatus('In progress')).toBe('on_track');
    expect(suggestStatus('Blocked')).toBe('behind');
    expect(suggestStatus('Completed')).toBe('done');
    expect(suggestStatus('Delayed')).toBe('at_risk');
    expect(suggestStatus('Parked')).toBe('not_started');
  });

  it('suggests quarter meanings', () => {
    expect(suggestQuarter('FY27-28')).toBe('next_year');
    expect(suggestQuarter('Q 3')).toBe('Q3');
    expect(suggestQuarter('Later')).toBe('next_year');
  });

  it('suggests due meanings', () => {
    expect(suggestDue('Next year')).toBe('next_year');
    expect(suggestDue('TBD')).toBe('quarter_end');
  });
});
