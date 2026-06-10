import { describe, it, expect } from 'vitest';
import { getHoursByType, getHoursByCategory, Task, Category } from './store';

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

const categories: Category[] = [
  { id: 'work', name: 'Work', emoji: '💼', bgColor: '#E8F4FB', textColor: '#2471A3', keywords: [] },
  { id: 'personal', name: 'Personal', emoji: '🌸', bgColor: '#F0EDF8', textColor: '#6B5EA8', keywords: [] },
];

describe('getHoursByType', () => {
  it('prefers actual time, falls back to estimate, then 1h default', () => {
    const tasks: Task[] = [
      makeTask({ taskType: 'build', actualMinutes: 120 }), // 2h actual
      makeTask({ title: '[1h] estimate only', taskType: 'build' }), // 1h estimate
      makeTask({ taskType: 'admin' }), // no data → 1h default
    ];
    const rows = getHoursByType(tasks);
    const build = rows.find(r => r.id === 'build')!;
    const admin = rows.find(r => r.id === 'admin')!;
    expect(build.hours).toBe(3); // 2 + 1
    expect(admin.hours).toBe(1);
    expect(build.label).toBe('Build');
    // sorted desc
    expect(rows[0].id).toBe('build');
  });

  it('folds untyped tasks into Other', () => {
    const rows = getHoursByType([makeTask({ actualMinutes: 60 })]);
    expect(rows[0].id).toBe('other');
    expect(rows[0].label).toBe('Other');
    expect(rows[0].hours).toBe(1);
  });
});

describe('getHoursByCategory', () => {
  it('aggregates hours per category with category metadata', () => {
    const tasks: Task[] = [
      makeTask({ categoryId: 'work', actualMinutes: 90 }), // 1.5h
      makeTask({ categoryId: 'work', actualMinutes: 30 }), // 0.5h
      makeTask({ categoryId: 'personal' }), // 1h default
    ];
    const rows = getHoursByCategory(tasks, categories);
    const work = rows.find(r => r.id === 'work')!;
    const personal = rows.find(r => r.id === 'personal')!;
    expect(work.hours).toBe(2);
    expect(work.label).toBe('Work');
    expect(work.color).toBe('#2471A3');
    expect(personal.hours).toBe(1);
    expect(rows[0].id).toBe('work'); // sorted desc
  });
});
