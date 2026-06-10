import { describe, it, expect } from 'vitest';
import {
  parseDurationInput,
  formatMinutes,
  autoClassifyTaskType,
  getEstimationStats,
  getSleepHabitInsight,
  Task,
  Habit,
  MoodEntry,
} from './store';

// Minimal task factory
function makeTask(p: Partial<Task>): Task {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    title: p.title ?? 'Task',
    column: p.column ?? 'today',
    categoryId: p.categoryId ?? 'work',
    createdAt: p.createdAt ?? '2026-06-01',
    ...p,
  } as Task;
}

describe('parseDurationInput', () => {
  it('parses hours', () => {
    expect(parseDurationInput('3h')).toBe(180);
    expect(parseDurationInput('1.5h')).toBe(90);
  });
  it('parses minutes', () => {
    expect(parseDurationInput('45m')).toBe(45);
  });
  it('parses combined h+m', () => {
    expect(parseDurationInput('2h30m')).toBe(150);
    expect(parseDurationInput('1h30m')).toBe(90);
  });
  it('treats a bare number as minutes', () => {
    expect(parseDurationInput('90')).toBe(90);
  });
  it('is whitespace and case tolerant', () => {
    expect(parseDurationInput('  3H ')).toBe(180);
    expect(parseDurationInput('1h 30m')).toBe(90);
  });
  it('returns 0 for garbage / empty', () => {
    expect(parseDurationInput('')).toBe(0);
    expect(parseDurationInput('abc')).toBe(0);
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(45)).toBe('45m');
  });
  it('handles empty', () => {
    expect(formatMinutes(0)).toBe('—');
  });
});

describe('autoClassifyTaskType', () => {
  it('classifies build/design/communication/exercise from keywords', () => {
    expect(autoClassifyTaskType('Build the API endpoint')).toBe('build');
    expect(autoClassifyTaskType('Design the new logo')).toBe('design');
    expect(autoClassifyTaskType('Email the client back')).toBe('communication');
    expect(autoClassifyTaskType('Morning gym session')).toBe('exercise');
    expect(autoClassifyTaskType('Submit tax invoice')).toBe('admin');
  });
  it('returns undefined when nothing matches', () => {
    expect(autoClassifyTaskType('Buy groceries xyz')).toBeUndefined();
  });
});

describe('getEstimationStats', () => {
  it('aggregates only done tasks with both estimate and actual', () => {
    const tasks: Task[] = [
      // build: estimate 60m, actual 90m → +50% underestimated
      makeTask({ title: '[1h] Build feature', taskType: 'build', actualMinutes: 90 }),
      // design: estimate 120m, actual 60m → -50% overestimated
      makeTask({ title: '[2h] Design mockup', taskType: 'design', actualMinutes: 60 }),
      // ignored: no actual
      makeTask({ title: '[1h] Plan sprint', taskType: 'plan' }),
      // ignored: no estimate
      makeTask({ title: 'Random task', taskType: 'create', actualMinutes: 30 }),
    ];
    const stats = getEstimationStats(tasks);
    expect(stats).toHaveLength(2);
    const build = stats.find(s => s.typeId === 'build')!;
    const design = stats.find(s => s.typeId === 'design')!;
    expect(build.diffPct).toBe(50);
    expect(build.count).toBe(1);
    expect(design.diffPct).toBe(-50);
    // sorted most-underestimated first
    expect(stats[0].typeId).toBe('build');
  });

  it('returns empty array when no qualifying tasks', () => {
    expect(getEstimationStats([makeTask({ title: 'no data' })])).toEqual([]);
  });
});

describe('getSleepHabitInsight', () => {
  const habits: Habit[] = [
    { id: 'h1', name: 'Read', emoji: '📚', completedDates: ['2026-06-01', '2026-06-02'] },
    { id: 'h2', name: 'Run', emoji: '🏃', completedDates: ['2026-06-01'] },
  ];
  function mood(date: string, sleep: number): MoodEntry {
    return { date, sleep } as MoodEntry;
  }

  it('returns null without enough data', () => {
    expect(getSleepHabitInsight([mood('2026-06-01', 8)], habits)).toBeNull();
    expect(getSleepHabitInsight([], habits)).toBeNull();
    expect(getSleepHabitInsight([mood('2026-06-01', 8)], [])).toBeNull();
  });

  it('computes a percentage when there are 2+ good and 2+ low sleep days', () => {
    const entries = [
      mood('2026-06-01', 8), // good — 2/2 habits done
      mood('2026-06-02', 8), // good — 1/2 habits done
      mood('2026-06-03', 5), // low — 0/2
      mood('2026-06-04', 5), // low — 0/2
    ];
    const res = getSleepHabitInsight(entries, habits);
    // low rate is 0 → guarded as null
    expect(res).toBeNull();
  });

  it('computes positive pctMore when good-sleep days have higher completion', () => {
    const habits2: Habit[] = [
      { id: 'h1', name: 'Read', emoji: '📚', completedDates: ['2026-06-01', '2026-06-02', '2026-06-03'] },
    ];
    const entries = [
      mood('2026-06-01', 8), // good — done
      mood('2026-06-02', 8), // good — done
      mood('2026-06-03', 5), // low — done
      mood('2026-06-04', 5), // low — not done
    ];
    const res = getSleepHabitInsight(entries, habits2);
    expect(res).not.toBeNull();
    // good rate = 2/2 = 1.0, low rate = 1/2 = 0.5 → +100%
    expect(res!.pctMore).toBe(100);
    expect(res!.goodDays).toBe(2);
    expect(res!.lowDays).toBe(2);
  });
});
