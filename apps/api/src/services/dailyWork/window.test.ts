import { describe, expect, it } from 'vitest';
import { clockParts, resolveTodayState, timeToSeconds, windowPhase } from './window';

const timezone = 'Asia/Kolkata';

function at(iso: string) {
  return new Date(iso);
}

describe('clockParts', () => {
  it('uses company timezone, not UTC calendar date', () => {
    const now = at('2026-09-11T20:00:00.000Z');
    expect(clockParts(now, 'UTC').workDate).toBe('2026-09-11');
    expect(clockParts(now, timezone).workDate).toBe('2026-09-12');
  });

  it('reads 18:00:00 IST as 18:00 in Asia/Kolkata', () => {
    const parts = clockParts(at('2026-09-11T12:30:00.000Z'), timezone);
    expect(parts.hour).toBe(18);
    expect(parts.minute).toBe(0);
    expect(parts.second).toBe(0);
  });
});

describe('timeToSeconds', () => {
  it('converts HH:MM and optional extra seconds', () => {
    expect(timeToSeconds('18:00')).toBe(18 * 3600);
    expect(timeToSeconds('23:59', 59)).toBe(23 * 3600 + 59 * 60 + 59);
  });
});

describe('daily work window', () => {
  it('rejects 17:59:59 before a 18:00 start', () => {
    const now = at('2026-09-11T12:29:59.000Z');
    expect(windowPhase(now, timezone, '18:00', '23:59')).toBe('BEFORE');
    expect(
      resolveTodayState({
        now,
        timezone,
        startTime: '18:00',
        endTime: '23:59',
        allowLateSubmission: true,
        submitted: false,
      }),
    ).toBe('LOCKED');
  });

  it('accepts exactly 18:00:00', () => {
    const now = at('2026-09-11T12:30:00.000Z');
    expect(windowPhase(now, timezone, '18:00', '23:59')).toBe('IN');
    expect(
      resolveTodayState({
        now,
        timezone,
        startTime: '18:00',
        endTime: '23:59',
        allowLateSubmission: false,
        submitted: false,
      }),
    ).toBe('OPEN');
  });

  it('stays open through the last second of the end minute', () => {
    const now = at('2026-09-11T18:29:59.000Z');
    expect(windowPhase(now, timezone, '18:00', '23:59')).toBe('IN');
  });

  it('marks late after the window when late is allowed', () => {
    const now = at('2026-09-11T16:00:00.000Z');
    expect(
      resolveTodayState({
        now,
        timezone,
        startTime: '18:00',
        endTime: '21:00',
        allowLateSubmission: true,
        submitted: false,
      }),
    ).toBe('LATE_AVAILABLE');
  });

  it('marks missed after the window when late is disabled', () => {
    const now = at('2026-09-11T16:00:00.000Z');
    expect(
      resolveTodayState({
        now,
        timezone,
        startTime: '18:00',
        endTime: '21:00',
        allowLateSubmission: false,
        submitted: false,
      }),
    ).toBe('MISSED');
  });

  it('keeps submitted work editable for the rest of that work date', () => {
    expect(
      resolveTodayState({
        now: at('2026-09-11T12:40:00.000Z'),
        timezone,
        startTime: '18:00',
        endTime: '23:59',
        allowLateSubmission: true,
        submitted: true,
      }),
    ).toBe('SUBMITTED_EDITABLE');
    expect(
      resolveTodayState({
        now: at('2026-09-11T18:30:00.000Z'),
        timezone,
        startTime: '18:00',
        endTime: '23:59',
        allowLateSubmission: true,
        submitted: true,
      }),
    ).toBe('SUBMITTED_EDITABLE');
  });
});
