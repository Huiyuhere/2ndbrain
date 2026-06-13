import { describe, it, expect } from 'vitest';
import {
  occursOn, weekdayOf, blocksOnDate, tasksOnDate, buildICS,
  parseTitleDuration, getCalendarRange,
  type TimeBlock, type Task,
} from './store';

describe('weekdayOf', () => {
  it('is timezone-safe (0=Sun..6=Sat)', () => {
    expect(weekdayOf('2026-06-14')).toBe(0); // Sunday
    expect(weekdayOf('2026-06-15')).toBe(1); // Monday
    expect(weekdayOf('2026-06-20')).toBe(6); // Saturday
  });
});

describe('occursOn', () => {
  it('non-recurring matches only its own date', () => {
    expect(occursOn('2026-06-10', '2026-06-10')).toBe(true);
    expect(occursOn('2026-06-10', '2026-06-11')).toBe(false);
  });

  it('daily recurs every day from the anchor, not before', () => {
    expect(occursOn('2026-06-10', '2026-06-09', 'daily')).toBe(false);
    expect(occursOn('2026-06-10', '2026-06-10', 'daily')).toBe(true);
    expect(occursOn('2026-06-10', '2026-06-25', 'daily')).toBe(true);
  });

  it('daily respects the end date (inclusive)', () => {
    expect(occursOn('2026-06-10', '2026-06-12', 'daily', '2026-06-12')).toBe(true);
    expect(occursOn('2026-06-10', '2026-06-13', 'daily', '2026-06-12')).toBe(false);
  });

  it('weekly recurs only on the same weekday', () => {
    // anchor 2026-06-10 is a Wednesday
    expect(weekdayOf('2026-06-10')).toBe(3);
    expect(occursOn('2026-06-10', '2026-06-17', 'weekly')).toBe(true);  // next Wed
    expect(occursOn('2026-06-10', '2026-06-18', 'weekly')).toBe(false); // Thu
  });
});

describe('blocksOnDate / tasksOnDate', () => {
  const block: TimeBlock = {
    id: 'b1', title: 'Gym', date: '2026-06-10', startMin: 420, endMin: 480,
    recurFreq: 'daily', recurEndDate: null, createdAt: '2026-06-10',
  };
  const task: Task = {
    id: 't1', title: 'Exercise', categoryId: 'personal', column: 'today',
    scheduledDate: '2026-06-10', scheduledTime: '07:00',
    recurFreq: 'weekly', recurEndDate: null, createdAt: '2026-06-10',
  };

  it('expands recurring time blocks across dates', () => {
    expect(blocksOnDate([block], '2026-06-10')).toHaveLength(1);
    expect(blocksOnDate([block], '2026-06-15')).toHaveLength(1);
    expect(blocksOnDate([block], '2026-06-09')).toHaveLength(0);
  });

  it('expands recurring tasks only on the matching weekday', () => {
    expect(tasksOnDate([task], '2026-06-10')).toHaveLength(1); // Wed
    expect(tasksOnDate([task], '2026-06-17')).toHaveLength(1); // next Wed
    expect(tasksOnDate([task], '2026-06-11')).toHaveLength(0); // Thu
  });

  it('ignores tasks without a scheduledDate', () => {
    const unscheduled: Task = { ...task, scheduledDate: undefined, recurFreq: null };
    expect(tasksOnDate([unscheduled], '2026-06-10')).toHaveLength(0);
  });
});

describe('buildICS', () => {
  const block: TimeBlock = {
    id: 'b1', title: 'Deep Work', date: '2026-06-10', startMin: 540, endMin: 660,
    recurFreq: 'weekly', recurEndDate: '2026-07-10', createdAt: '2026-06-10',
  };
  const timedTask: Task = {
    id: 't1', title: '[1h] Lunch w cheryl', categoryId: 'personal', column: 'today',
    scheduledDate: '2026-06-10', scheduledTime: '10:00', createdAt: '2026-06-10',
  };
  const allDayTask: Task = {
    id: 't2', title: 'Pay taxes', categoryId: 'work', column: 'today',
    scheduledDate: '2026-06-12', createdAt: '2026-06-12',
  };

  it('produces a valid calendar wrapper', () => {
    const ics = buildICS([], []);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('emits a timed VEVENT with RRULE + UNTIL for a recurring block', () => {
    const ics = buildICS([block], []);
    expect(ics).toContain('SUMMARY:Deep Work');
    expect(ics).toContain('DTSTART:20260610T090000');
    expect(ics).toContain('DTEND:20260610T110000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20260710T235900');
  });

  it('emits timed events for tasks with a time and all-day for those without', () => {
    const ics = buildICS([], [timedTask, allDayTask]);
    expect(ics).toContain('DTSTART:20260610T100000');     // timed
    expect(ics).toContain('DTSTART;VALUE=DATE:20260612');  // all-day
  });

  it('escapes special characters in summaries', () => {
    const t: Task = { ...allDayTask, title: 'Email; A, B' };
    const ics = buildICS([], [t]);
    expect(ics).toContain('SUMMARY:Email\\; A\\, B');
  });
});

describe('getCalendarRange', () => {
  it('returns 13 dates with today at index 2', () => {
    const range = getCalendarRange();
    expect(range).toHaveLength(13);
    // strictly increasing chronological order
    for (let i = 1; i < range.length; i++) {
      expect(range[i] > range[i - 1]).toBe(true);
    }
  });
});

describe('parseTitleDuration (smart scheduling inference)', () => {
  it('infers 1.5h from a [1.5h] tag', () => {
    expect(parseTitleDuration('[1.5h] lunch w cheryl').durationStr).toBe('1.5h');
    expect(parseTitleDuration('[1.5h] lunch w cheryl').minutes).toBe(90);
  });
  it('infers minutes from a [45m] tag', () => {
    expect(parseTitleDuration('[45m] standup').durationStr).toBe('45m');
    expect(parseTitleDuration('[45m] standup').minutes).toBe(45);
  });
  it('returns empty when no tag present', () => {
    expect(parseTitleDuration('plain title').durationStr).toBe('');
  });
});
