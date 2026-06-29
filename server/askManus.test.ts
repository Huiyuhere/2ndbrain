import { describe, it, expect } from "vitest";
import { computeSnapshot, type SnapshotInput } from "./askManus";

// Fixed "today" so windowing is deterministic.
const TODAY = "2026-06-15";

function baseInput(): SnapshotInput {
  return {
    tasks: [],
    moods: [],
    evenings: [],
    habitData: { habits: [], completions: [] },
    reflections: [],
    goals: [],
    profile: null,
  };
}

describe("computeSnapshot — totals & task breakdowns", () => {
  it("counts created/done/open and weekday buckets correctly", () => {
    const input = baseInput();
    input.tasks = [
      // 2026-06-09 is a Tuesday; 2026-06-08 is Monday
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-08", taskType: "build", categoryId: "c1", duration: null, actualMinutes: null, title: "A" },
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-09", taskType: "build", categoryId: "c1", duration: null, actualMinutes: null, title: "B" },
      { column: "todo", completedAt: null, createdAt: "2026-06-10", taskType: "admin", categoryId: "c2", duration: null, actualMinutes: null, title: "C" },
    ];
    const s = computeSnapshot(input, TODAY);
    expect(s.totals.tasksCreated).toBe(3);
    expect(s.totals.tasksDone).toBe(2);
    expect(s.totals.openTasks).toBe(1);
    // both completed on a Tuesday
    expect(s.completionByWeekday.Tue).toBe(2);
    // by type completion rate
    expect(s.byTaskType.build).toEqual({ created: 2, done: 2, completionRate: 100 });
    expect(s.byTaskType.admin).toEqual({ created: 1, done: 0, completionRate: 0 });
  });

  it("buckets untyped tasks under 'untyped'", () => {
    const input = baseInput();
    input.tasks = [
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-09", taskType: null, categoryId: null, duration: null, actualMinutes: null, title: "X" },
    ];
    const s = computeSnapshot(input, TODAY);
    expect(s.byTaskType.untyped.created).toBe(1);
    expect(s.byCategory.uncategorized.created).toBe(1);
  });
});

describe("computeSnapshot — estimation", () => {
  it("computes avg error and over/under counts from timed tasks only", () => {
    const input = baseInput();
    input.tasks = [
      // est 60m, actual 90m → +50% (overran)
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-08", taskType: "build", categoryId: "c1", duration: "1h", actualMinutes: 90, title: "over" },
      // est 60m, actual 30m → -50% (underran)
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-08", taskType: "build", categoryId: "c1", duration: "1h", actualMinutes: 30, title: "under" },
      // no actual → ignored
      { column: "done", completedAt: "2026-06-09", createdAt: "2026-06-08", taskType: "build", categoryId: "c1", duration: "1h", actualMinutes: null, title: "skip" },
    ];
    const s = computeSnapshot(input, TODAY);
    expect(s.estimation.samples).toBe(2);
    expect(s.estimation.overran).toBe(1);
    expect(s.estimation.underran).toBe(1);
    expect(s.estimation.avgErrorPct).toBe(0); // (50 + -50)/2
  });

  it("reports no-data note when nothing is timed", () => {
    const s = computeSnapshot(baseInput(), TODAY);
    expect(s.estimation.samples).toBe(0);
    expect(s.estimation.avgErrorPct).toBeNull();
    expect(s.estimation.note).toMatch(/not enough timed tasks/i);
  });
});

describe("computeSnapshot — mood/sleep correlation", () => {
  it("splits completion averages by sleep and mood buckets", () => {
    const input = baseInput();
    input.moods = [
      { date: "2026-06-10", mood: 1, sleep: 5 }, // low sleep, low mood
      { date: "2026-06-11", mood: 5, sleep: 8 }, // normal sleep, good mood
    ];
    input.tasks = [
      { column: "done", completedAt: "2026-06-10", createdAt: "2026-06-10", taskType: "build", categoryId: "c1", duration: null, actualMinutes: null, title: "a" },
      { column: "done", completedAt: "2026-06-11", createdAt: "2026-06-11", taskType: "build", categoryId: "c1", duration: null, actualMinutes: null, title: "b" },
      { column: "done", completedAt: "2026-06-11", createdAt: "2026-06-11", taskType: "build", categoryId: "c1", duration: null, actualMinutes: null, title: "c" },
    ];
    const s = computeSnapshot(input, TODAY);
    expect(s.moodSleep.lowSleepSampleDays).toBe(1);
    expect(s.moodSleep.avgTasksDone_lowSleep_under6_5h).toBe(1); // 1 task on the low-sleep day
    expect(s.moodSleep.normalSleepSampleDays).toBe(1);
    expect(s.moodSleep.avgTasksDone_normalSleep).toBe(2); // 2 tasks on the normal-sleep day
    expect(s.moodSleep.lowMoodSampleDays).toBe(1);
    expect(s.moodSleep.goodMoodSampleDays).toBe(1);
  });

  it("returns null averages when no mood entries exist", () => {
    const s = computeSnapshot(baseInput(), TODAY);
    expect(s.moodSleep.avgMood).toBeNull();
    expect(s.moodSleep.avgSleep).toBeNull();
    expect(s.moodSleep.avgTasksDone_lowSleep_under6_5h).toBeNull();
  });
});

describe("computeSnapshot — habits, goals, journal window", () => {
  it("counts all-time habit completions and journal days in window", () => {
    const input = baseInput();
    input.habitData = {
      habits: [{ id: "h1", name: "Read" }, { id: "h2", name: "Run" }],
      completions: [{ habitId: "h1" }, { habitId: "h1" }, { habitId: "h2" }],
    };
    input.evenings = [
      { date: "2026-06-14" }, // in window
      { date: "2026-06-14" }, // duplicate day → distinct count = still counts entries
      { date: "2020-01-01" }, // out of 90d window
    ];
    const s = computeSnapshot(input, TODAY);
    const read = s.habitsAllTime.find(h => h.name === "Read")!;
    expect(read.completions).toBe(2);
    expect(s.journal.entriesInWindow).toBe(2); // two June entries
    expect(s.journal.distinctDaysJournaledInWindow).toBe(1); // same date
  });

  it("passes through goals and profile fields", () => {
    const input = baseInput();
    input.profile = { quarterlyGoalText: "Ship", quarterlyGoalProgress: 40, monthlyIntention: "Focus" };
    input.goals = [{ title: "Launch", progress: 20, done: false }];
    const s = computeSnapshot(input, TODAY);
    expect(s.goals.quarterlyGoal).toBe("Ship");
    expect(s.goals.quarterlyProgress).toBe(40);
    expect(s.goals.items[0]).toEqual({ title: "Launch", progress: 20, done: false });
  });
});

describe("computeSnapshot — windowing", () => {
  it("sets windowStart 90 days before today by default", () => {
    const s = computeSnapshot(baseInput(), TODAY);
    expect(s.today).toBe(TODAY);
    expect(s.windowDays).toBe(90);
    // 2026-06-15 minus 90 days = 2026-03-17
    expect(s.windowStart).toBe("2026-03-17");
  });
});
