/**
 * "Ask Manus" — a grounded analytics chat.
 *
 * Builds a compact, FACTUAL snapshot of the user's real data (all-time aggregates
 * plus a recent detail window) and asks the LLM to answer free-form questions using
 * ONLY that snapshot. The system prompt forbids inventing numbers; if data is thin,
 * the model is told to say what's missing rather than guess.
 *
 * Everything here is server-side so credentials never reach the client.
 */

import { invokeLLM, type Message } from "./_core/llm";
import {
  getTasks,
  getMoodEntries,
  getEveningEntries,
  getHabits,
  getReflections,
  getGoals,
  getOrCreateProfile,
} from "./db";

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

function sgtNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + SGT_OFFSET_MS);
}

function dateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Weekday short-name for a YYYY-MM-DD string. */
function weekday(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

/** Days between two YYYY-MM-DD (a - b), used for windowing. */
function daysBefore(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return dateStr(d);
}

/** Parse a duration string like "1.5h", "90m", "2h" into minutes. */
function durationToMinutes(duration?: string | null): number | null {
  if (!duration) return null;
  const h = duration.match(/([\d.]+)\s*h/i);
  const m = duration.match(/([\d.]+)\s*m(?!s)/i);
  let mins = 0;
  if (h) mins += parseFloat(h[1]) * 60;
  if (m) mins += parseFloat(m[1]);
  return mins > 0 ? Math.round(mins) : null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100;
}

export type AnalyticsSnapshot = {
  today: string;
  windowDays: number;
  windowStart: string;
  totals: {
    tasksCreated: number;
    tasksDone: number;
    openTasks: number;
    moodEntries: number;
    journalEntries: number;
    habitsTracked: number;
    reflections: number;
  };
  completionByWeekday: Record<string, number>;
  createdByWeekday: Record<string, number>;
  byTaskType: Record<string, { created: number; done: number; completionRate: number | null }>;
  byCategory: Record<string, { created: number; done: number }>;
  estimation: {
    samples: number;
    avgErrorPct: number | null; // positive = overran estimate
    overran: number;
    underran: number;
    note: string;
  };
  moodSleep: {
    avgMood: number | null;
    avgSleep: number | null;
    entries: number;
    avgTasksDone_lowSleep_under6_5h: number | null;
    lowSleepSampleDays: number;
    avgTasksDone_normalSleep: number | null;
    normalSleepSampleDays: number;
    avgTasksDone_lowMood_1to2: number | null;
    lowMoodSampleDays: number;
    avgTasksDone_goodMood_4to5: number | null;
    goodMoodSampleDays: number;
  };
  habitsAllTime: { name: string; completions: number }[];
  journal: {
    entriesInWindow: number;
    distinctDaysJournaledInWindow: number;
    windowDays: number;
  };
  goals: {
    quarterlyGoal: string | null;
    quarterlyProgress: number | null;
    monthlyIntention: string | null;
    items: { title: string; progress: number | null; done: boolean }[];
  };
  recentMoodSleep: { date: string; mood: number; sleep: number }[];
  recentCompletedTaskTitles: string[];
};

/** Minimal shapes the pure aggregator needs (subset of the DB rows). */
export type SnapshotInput = {
  tasks: {
    column: string;
    completedAt?: string | null;
    createdAt: string;
    taskType?: string | null;
    categoryId?: string | null;
    duration?: string | null;
    actualMinutes?: number | null;
    title: string;
  }[];
  moods: { date: string; mood: number; sleep: number }[];
  evenings: { date: string }[];
  habitData: { habits: { id: string; name: string }[]; completions: { habitId: string }[] };
  reflections: { id?: unknown }[];
  goals: { title: string; progress?: number | null; done?: boolean | null }[];
  profile: {
    quarterlyGoalText?: string | null;
    quarterlyGoalProgress?: number | null;
    monthlyIntention?: string | null;
  } | null;
};

/**
 * Pure aggregation: turns raw-ish data into the factual snapshot. No I/O, fully
 * deterministic given `today` — this is what the unit tests exercise.
 */
export function computeSnapshot(
  data: SnapshotInput,
  today: string,
  windowDays = 90
): AnalyticsSnapshot {
  const { tasks, moods, evenings, habitData, reflections, goals, profile } = data;
  const windowStart = daysBefore(today, windowDays);

  const done = tasks.filter(t => t.column === "done" && t.completedAt);

  // ── Weekday breakdowns ──
  const completionByWeekday: Record<string, number> = {};
  for (const t of done) {
    if (t.completedAt) completionByWeekday[weekday(t.completedAt)] = (completionByWeekday[weekday(t.completedAt)] || 0) + 1;
  }
  const createdByWeekday: Record<string, number> = {};
  for (const t of tasks) {
    createdByWeekday[weekday(t.createdAt)] = (createdByWeekday[weekday(t.createdAt)] || 0) + 1;
  }

  // ── By task type & category ──
  const byTaskType: Record<string, { created: number; done: number; completionRate: number | null }> = {};
  const byCategory: Record<string, { created: number; done: number }> = {};
  for (const t of tasks) {
    const tk = t.taskType || "untyped";
    byTaskType[tk] = byTaskType[tk] || { created: 0, done: 0, completionRate: null };
    byTaskType[tk].created++;
    if (t.column === "done") byTaskType[tk].done++;

    const ck = t.categoryId || "uncategorized";
    byCategory[ck] = byCategory[ck] || { created: 0, done: 0 };
    byCategory[ck].created++;
    if (t.column === "done") byCategory[ck].done++;
  }
  for (const k of Object.keys(byTaskType)) {
    const v = byTaskType[k];
    v.completionRate = v.created > 0 ? Math.round((v.done / v.created) * 100) : null;
  }

  // ── Estimation accuracy ──
  let errSum = 0, samples = 0, overran = 0, underran = 0;
  for (const t of done) {
    const est = durationToMinutes(t.duration);
    const act = t.actualMinutes ?? null;
    if (est && act && est > 0) {
      const e = ((act - est) / est) * 100;
      errSum += e;
      samples++;
      if (e > 10) overran++;
      else if (e < -10) underran++;
    }
  }
  const avgErrorPct = samples > 0 ? Math.round(errSum / samples) : null;
  let estNote = "Not enough timed tasks (need tasks with both an estimate and a logged actual time) to judge estimation.";
  if (samples > 0 && avgErrorPct !== null) {
    estNote =
      avgErrorPct > 15
        ? `On average tasks ran ${avgErrorPct}% OVER estimate — chronic under-estimation.`
        : avgErrorPct < -15
          ? `On average tasks finished ${Math.abs(avgErrorPct)}% UNDER estimate — padding estimates.`
          : `Estimates were broadly accurate (avg ${avgErrorPct}% off).`;
  }

  // ── Mood / sleep correlations ──
  const moodByDate: Record<string, { mood: number; sleep: number }> = {};
  for (const m of moods) moodByDate[m.date] = { mood: m.mood, sleep: m.sleep };
  const doneByDate: Record<string, number> = {};
  for (const t of done) if (t.completedAt) doneByDate[t.completedAt] = (doneByDate[t.completedAt] || 0) + 1;

  const lowSleep: number[] = [], normalSleep: number[] = [];
  const lowMood: number[] = [], goodMood: number[] = [];
  for (const [date, mv] of Object.entries(moodByDate)) {
    const c = doneByDate[date] || 0;
    if (mv.sleep < 6.5) lowSleep.push(c);
    else normalSleep.push(c);
    if (mv.mood <= 2) lowMood.push(c);
    else if (mv.mood >= 4) goodMood.push(c);
  }
  const avgMood = moods.length ? avg(moods.map(m => m.mood)) : null;
  const avgSleep = moods.length ? avg(moods.map(m => m.sleep)) : null;

  // ── Habits (all-time) ──
  const habitsAllTime = habitData.habits.map(h => ({
    name: h.name,
    completions: habitData.completions.filter(c => c.habitId === h.id).length,
  }));

  // ── Journal frequency in window ──
  const windowEvenings = evenings.filter(e => e.date >= windowStart && e.date <= today);
  const journaledDays = new Set(windowEvenings.map(e => e.date));

  return {
    today,
    windowDays,
    windowStart,
    totals: {
      // (kept inline below)
      tasksCreated: tasks.length,
      tasksDone: done.length,
      openTasks: tasks.filter(t => t.column !== "done").length,
      moodEntries: moods.length,
      journalEntries: evenings.length,
      habitsTracked: habitData.habits.length,
      reflections: reflections.length,
    },
    completionByWeekday,
    createdByWeekday,
    byTaskType,
    byCategory,
    estimation: { samples, avgErrorPct, overran, underran, note: estNote },
    moodSleep: {
      avgMood,
      avgSleep,
      entries: moods.length,
      avgTasksDone_lowSleep_under6_5h: avg(lowSleep),
      lowSleepSampleDays: lowSleep.length,
      avgTasksDone_normalSleep: avg(normalSleep),
      normalSleepSampleDays: normalSleep.length,
      avgTasksDone_lowMood_1to2: avg(lowMood),
      lowMoodSampleDays: lowMood.length,
      avgTasksDone_goodMood_4to5: avg(goodMood),
      goodMoodSampleDays: goodMood.length,
    },
    habitsAllTime,
    journal: {
      entriesInWindow: windowEvenings.length,
      distinctDaysJournaledInWindow: journaledDays.size,
      windowDays,
    },
    goals: {
      quarterlyGoal: profile?.quarterlyGoalText ?? null,
      quarterlyProgress: profile?.quarterlyGoalProgress ?? null,
      monthlyIntention: profile?.monthlyIntention ?? null,
      items: goals.map(g => ({ title: g.title, progress: g.progress ?? null, done: g.done ?? false })),
    },
    recentMoodSleep: moods.slice(-28).map(m => ({ date: m.date, mood: m.mood, sleep: m.sleep })),
    recentCompletedTaskTitles: done
      .filter(t => t.completedAt && t.completedAt >= windowStart)
      .slice(-40)
      .map(t => t.title),
  };
}

/**
 * Build a factual snapshot of the user's data by fetching then delegating to the
 * pure aggregator.
 * - All-time aggregates for robust pattern detection.
 * - A recent detail window (default 90 days) for granular references.
 */
export async function buildAnalyticsSnapshot(
  userId: number,
  windowDays = 90
): Promise<AnalyticsSnapshot> {
  const today = dateStr(sgtNow());
  const [tasks, moods, evenings, habitData, reflections, goals, profile] = await Promise.all([
    getTasks(userId),
    getMoodEntries(userId),
    getEveningEntries(userId),
    getHabits(userId),
    getReflections(userId),
    getGoals(userId),
    getOrCreateProfile(userId),
  ]);
  return computeSnapshot(
    {
      tasks: tasks as unknown as SnapshotInput["tasks"],
      moods: moods as unknown as SnapshotInput["moods"],
      evenings: evenings as unknown as SnapshotInput["evenings"],
      habitData: habitData as unknown as SnapshotInput["habitData"],
      reflections: reflections as unknown as SnapshotInput["reflections"],
      goals: goals as unknown as SnapshotInput["goals"],
      profile: profile as unknown as SnapshotInput["profile"],
    },
    today,
    windowDays
  );
}

const SYSTEM_PROMPT = `You are "Ask Manus", an analytics co-pilot embedded inside the user's personal productivity app ("2nd Brain"). You help the user explore patterns in their own logged data — tasks, time/estimation, mood, sleep, habits, journaling, goals and reflections — beyond the app's standard charts.

HARD RULES (non-negotiable):
- Answer using ONLY the JSON data snapshot provided in the first user message. It is the single source of truth.
- NEVER invent or estimate numbers, dates, tasks, moods, or trends. Every quantitative claim MUST trace to a field in the snapshot.
- When you state a finding, cite the concrete numbers you used (e.g. "you complete 11 tasks on Tuesdays vs 1 on Sundays").
- If the data is insufficient or a sample is small, SAY SO explicitly (e.g. "this is only based on 2 days, so it's not conclusive") instead of overclaiming. A gap in the data is itself a valid finding ("you haven't logged actual time on most tasks").
- Do NOT answer questions unrelated to the user's productivity/well-being data. If asked something off-topic, briefly redirect to what their data can answer.

STYLE:
- Be direct, concise, and practical. Markdown. Short paragraphs and tight bullet lists (mobile screen).
- It's fine to give 1-3 actionable suggestions, but each must follow logically from the data you cited.
- Talk in second person ("you"), present tense.`;

/**
 * Answer a question (with prior chat turns) grounded in the user's data snapshot.
 * The snapshot is injected as the first user message; subsequent messages are the
 * actual conversation.
 */
export async function answerQuestion(
  userId: number,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const snapshot = await buildAnalyticsSnapshot(userId);

  const snapshotMsg: Message = {
    role: "user",
    content: `Here is the verified JSON snapshot of MY data. Use ONLY this to answer my questions. Today is ${snapshot.today}.

\`\`\`json
${JSON.stringify(snapshot)}
\`\`\`

I'll ask my questions in the following messages. Acknowledge silently and just answer.`,
  };

  const convo: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    snapshotMsg,
    ...history.map(m => ({ role: m.role, content: m.content }) as Message),
  ];

  const res = await invokeLLM({ messages: convo });
  const content = res.choices?.[0]?.message?.content ?? "";
  if (typeof content === "string") return content;
  // content may be an array of parts
  return (content as Array<{ type: string; text?: string }>)
    .map(p => (p.type === "text" && "text" in p ? (p.text ?? "") : ""))
    .join("");
}
