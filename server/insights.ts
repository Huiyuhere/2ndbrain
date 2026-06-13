/**
 * Reflection Insights engine.
 *
 * Aggregates a user's real data for a weekly / monthly / quarterly period and
 * asks the LLM to produce a CEO-mentor style review grounded ONLY in that data.
 *
 * Everything here is server-side. The aggregation produces a compact, factual
 * "data brief" object; the LLM is explicitly told to never invent numbers.
 */

import { invokeLLM } from "./_core/llm";
import {
  getTasks,
  getMoodEntries,
  getEveningEntries,
  getHabits,
  getReflections,
  getGoals,
  getOrCreateProfile,
  getReflectionInsight,
  upsertReflectionInsight,
} from "./db";

export type Period = "weekly" | "monthly" | "quarterly";

// ─── SGT date helpers (mirror client store.ts; UTC+8) ──────────────────────────

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

/** ISO week number (1..53) for a Date interpreted via its UTC fields. */
function isoWeek(d: Date): { year: number; week: number } {
  // Copy and shift to Thursday of the current ISO week
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (t.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  t.setUTCDate(t.getUTCDate() - dayNr + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: t.getUTCFullYear(), week };
}

/**
 * Returns the canonical period key for the period that CONTAINS the given
 * reference date (default: now, in SGT).
 *  - weekly:    "2026-W24"
 *  - monthly:   "2026-06"
 *  - quarterly: "2026-Q2"
 */
export function getPeriodKey(period: Period, ref: Date = sgtNow()): string {
  const y = ref.getUTCFullYear();
  if (period === "weekly") {
    const { year, week } = isoWeek(ref);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (period === "monthly") {
    return `${y}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const q = Math.floor(ref.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

/**
 * Inclusive [start, end] YYYY-MM-DD date strings (SGT) covered by a period key.
 * Supports the same key formats produced by getPeriodKey.
 */
export function getPeriodRange(period: Period, periodKey: string): { start: string; end: string } {
  if (period === "weekly") {
    // periodKey like 2026-W24 → Monday..Sunday of that ISO week
    const [yStr, wStr] = periodKey.split("-W");
    const year = Number(yStr);
    const week = Number(wStr);
    // ISO week 1 contains Jan 4th. Find the Monday of week 1, then add (week-1) weeks.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = (jan4.getUTCDay() + 6) % 7; // Mon=0
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
    const monday = new Date(week1Monday);
    monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: dateStr(monday), end: dateStr(sunday) };
  }
  if (period === "monthly") {
    const [yStr, mStr] = periodKey.split("-");
    const year = Number(yStr);
    const month = Number(mStr); // 1-12
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0)); // last day of month
    return { start: dateStr(start), end: dateStr(end) };
  }
  // quarterly: 2026-Q2
  const [yStr, qStr] = periodKey.split("-Q");
  const year = Number(yStr);
  const q = Number(qStr); // 1-4
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return { start: dateStr(start), end: dateStr(end) };
}

/** Human-readable label for a period key, e.g. "Week 24, 2026" / "June 2026" / "Q2 2026". */
export function getPeriodLabel(period: Period, periodKey: string): string {
  if (period === "weekly") {
    const { start, end } = getPeriodRange(period, periodKey);
    return `${start} → ${end}`;
  }
  if (period === "monthly") {
    const [y, m] = periodKey.split("-");
    const monthName = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    return `${monthName} ${y}`;
  }
  const [y, q] = periodKey.split("-Q");
  return `Q${q} ${y}`;
}

// ─── Aggregation ────────────────────────────────────────────────────────────

function inRange(dateStrVal: string | null | undefined, start: string, end: string): boolean {
  if (!dateStrVal) return false;
  return dateStrVal >= start && dateStrVal <= end;
}

/** All YYYY-MM-DD dates in [start,end], capped to today (no future days counted). */
function datesInRange(start: string, end: string, today: string): string[] {
  const out: string[] = [];
  const cappedEnd = end < today ? end : today;
  const [sy, sm, sd] = start.split("-").map(Number);
  let cur = new Date(Date.UTC(sy, sm - 1, sd));
  const endParts = cappedEnd.split("-").map(Number);
  const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));
  while (cur <= endDate) {
    out.push(dateStr(cur));
    cur = new Date(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
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

export type DataBrief = {
  period: Period;
  periodKey: string;
  label: string;
  range: { start: string; end: string };
  generatedFor: string;
  tasks: {
    completed: number;
    created: number;
    completionRate: number | null;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    adminCompleted: number;
    completedTitles: string[];
    carriedOverOpen: number; // open tasks created before this period still not done
  };
  estimation: {
    samples: number;
    avgErrorPct: number | null; // positive = overran estimate
    overran: number;
    underran: number;
    note: string;
  };
  mood: { avgMood: number | null; avgSleep: number | null; entries: number };
  habits: {
    tracked: number;
    totalPossible: number;
    totalDone: number;
    consistencyPct: number | null;
    perHabit: { name: string; done: number; possible: number }[];
  };
  journal: {
    daysInPeriod: number;
    daysJournaled: number;
    missedDays: number;
    missedDates: string[];
  };
  goals: {
    quarterlyGoalText: string | null;
    quarterlyGoalProgress: number | null;
    monthlyIntention: string | null;
    items: { title: string; progress: number; done: boolean; dueDate: string | null }[];
  };
  reflections: { type: string; date: string; answers: Record<string, string> }[];
};

export async function buildDataBrief(
  userId: number,
  period: Period,
  periodKey: string
): Promise<DataBrief> {
  const range = getPeriodRange(period, periodKey);
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

  // ── Tasks ──
  const completedTasks = tasks.filter(
    t => t.column === "done" && inRange(t.completedAt, range.start, range.end)
  );
  const createdTasks = tasks.filter(t => inRange(t.createdAt, range.start, range.end));
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let adminCompleted = 0;
  for (const t of completedTasks) {
    const type = t.taskType || "untyped";
    byType[type] = (byType[type] || 0) + 1;
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + 1;
    if (type === "admin") adminCompleted++;
  }
  const carriedOverOpen = tasks.filter(
    t => t.column !== "done" && t.createdAt < range.start
  ).length;

  // ── Estimation accuracy (tasks completed this period with both estimate & actual) ──
  let errSum = 0;
  let samples = 0;
  let overran = 0;
  let underran = 0;
  for (const t of completedTasks) {
    const est = durationToMinutes(t.duration);
    const act = t.actualMinutes ?? null;
    if (est && act && est > 0) {
      const errPct = ((act - est) / est) * 100;
      errSum += errPct;
      samples++;
      if (errPct > 10) overran++;
      else if (errPct < -10) underran++;
    }
  }
  const avgErrorPct = samples > 0 ? Math.round(errSum / samples) : null;
  let estNote = "Not enough timed tasks to judge estimation.";
  if (samples > 0 && avgErrorPct !== null) {
    estNote =
      avgErrorPct > 15
        ? `On average tasks ran ${avgErrorPct}% OVER estimate — chronic under-estimation.`
        : avgErrorPct < -15
          ? `On average tasks finished ${Math.abs(avgErrorPct)}% UNDER estimate — padding estimates.`
          : `Estimates were broadly accurate (avg ${avgErrorPct}% off).`;
  }

  // ── Mood / sleep ──
  const periodMoods = moods.filter(m => inRange(m.date, range.start, range.end));
  const avgMood =
    periodMoods.length > 0
      ? Math.round((periodMoods.reduce((s, m) => s + (m.mood ?? 0), 0) / periodMoods.length) * 10) / 10
      : null;
  const avgSleep =
    periodMoods.length > 0
      ? Math.round((periodMoods.reduce((s, m) => s + (m.sleep ?? 0), 0) / periodMoods.length) * 10) / 10
      : null;

  // ── Habits ──
  const periodDates = datesInRange(range.start, range.end, today);
  const perHabit = habitData.habits.map(h => {
    const done = habitData.completions.filter(
      c => c.habitId === h.id && inRange(c.date, range.start, range.end)
    ).length;
    return { name: h.name, done, possible: periodDates.length };
  });
  const totalPossible = perHabit.reduce((s, h) => s + h.possible, 0);
  const totalDone = perHabit.reduce((s, h) => s + h.done, 0);
  const consistencyPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : null;

  // ── Journal gaps (evening entries) ──
  const journaledDates = new Set(
    evenings.filter(e => inRange(e.date, range.start, range.end)).map(e => e.date)
  );
  const missedDates = periodDates.filter(d => !journaledDates.has(d));

  // ── Goals ──
  const goalItems = goals.map(g => ({
    title: g.title,
    progress: g.progress ?? 0,
    done: g.done ?? false,
    dueDate: g.dueDate ?? null,
  }));

  // ── Reflections in this period ──
  const periodReflections = reflections
    .filter(r => inRange(r.date, range.start, range.end))
    .map(r => ({ type: r.type, date: r.date, answers: (r.answers ?? {}) as Record<string, string> }));

  return {
    period,
    periodKey,
    label: getPeriodLabel(period, periodKey),
    range,
    generatedFor: today,
    tasks: {
      completed: completedTasks.length,
      created: createdTasks.length,
      completionRate:
        createdTasks.length > 0
          ? Math.round((completedTasks.length / createdTasks.length) * 100)
          : null,
      byType,
      byCategory,
      adminCompleted,
      completedTitles: completedTasks.slice(0, 40).map(t => t.title),
      carriedOverOpen,
    },
    estimation: { samples, avgErrorPct, overran, underran, note: estNote },
    mood: { avgMood, avgSleep, entries: periodMoods.length },
    habits: {
      tracked: habitData.habits.length,
      totalPossible,
      totalDone,
      consistencyPct,
      perHabit,
    },
    journal: {
      daysInPeriod: periodDates.length,
      daysJournaled: journaledDates.size,
      missedDays: missedDates.length,
      missedDates: missedDates.slice(0, 31),
    },
    goals: {
      quarterlyGoalText: profile?.quarterlyGoalText ?? null,
      quarterlyGoalProgress: profile?.quarterlyGoalProgress ?? null,
      monthlyIntention: profile?.monthlyIntention ?? null,
      items: goalItems,
    },
    reflections: periodReflections,
  };
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const DEPTH: Record<Period, string> = {
  weekly:
    "This is a WEEKLY review. Keep it SHORT and PUNCHY — 5 sections max, a few sentences each. No long essays.",
  monthly:
    "This is a MONTHLY review. Medium depth — connect the weeks into a trend, name the pattern, then push.",
  quarterly:
    "This is a QUARTERLY review. Go DEEP — this is the strategic one. Audit the quarterly goal hard, judge the whole 90 days, and set the agenda for next quarter.",
};

function buildSystemPrompt(period: Period): string {
  return `You are the user's no-nonsense CEO-mentor and chief of staff. You review their actual productivity data and tell them the truth — the way a sharp, busy founder-mentor would in a 1:1 they paid a lot for.

VOICE & RULES (non-negotiable):
- Direct. No fluff, no hedging, no therapy-speak, no "great job!" filler.
- Call out leaky buckets, excuses, and self-deception. Name hard truths.
- Ground EVERY claim ONLY in the data brief you are given. NEVER invent numbers, tasks, moods, or events. If data is missing, say "you didn't record it" — that itself is a finding.
- Explicitly check in on the quarterly goal and any other set goals. If progress is thin, say so plainly.
- Call out missing journal/check-in days using the real missed count: "you can't review what you don't record."
- Flag two specific patterns when the data supports them: (1) overpromising — creating far more than you finish, chronic under-estimation; (2) avoidance of admin / repetitive tasks (low admin completion despite a backlog).
- Speak in second person ("you"), present tense, confident.

FORMAT (strict):
- Markdown. Every header (##) MUST start with a single relevant emoji, then the title.
- Lead with a one-line verdict in bold under the title.
- Use short paragraphs and tight bullet lists. Mobile screen — keep lines short.
- End with a section "## 🎯 Your Orders for Next ${period === "weekly" ? "Week" : period === "monthly" ? "Month" : "Quarter"}" containing 3-5 NON-NEGOTIABLE orders (imperative, specific, measurable). These are orders, not gentle suggestions.

${DEPTH[period]}`;
}

function buildUserPrompt(brief: DataBrief): string {
  return `Here is the verified data brief for ${brief.label} (${brief.range.start} to ${brief.range.end}). Today is ${brief.generatedFor}. Base your entire review on this and nothing else.

\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\`

Write the ${brief.period} review now. Remember: emoji on every header, bold one-line verdict up top, and end with non-negotiable orders.`;
}

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  return content
    .map(p => (p.type === "text" && "text" in p ? (p.text ?? "") : ""))
    .join("");
}

/**
 * Generate (or regenerate) the insight for a period and cache it.
 * Returns the markdown content.
 */
export async function generateInsight(
  userId: number,
  period: Period,
  periodKey: string
): Promise<{ content: string; brief: DataBrief }> {
  const brief = await buildDataBrief(userId, period, periodKey);
  const res = await invokeLLM({
    messages: [
      { role: "system", content: buildSystemPrompt(period) },
      { role: "user", content: buildUserPrompt(brief) },
    ],
  });
  const content = extractText(res.choices[0]?.message?.content ?? "").trim();
  if (content) {
    await upsertReflectionInsight(userId, period, periodKey, content);
  }
  return { content, brief };
}

/** Return the cached insight if present, otherwise generate one. */
export async function getOrGenerateInsight(
  userId: number,
  period: Period,
  periodKey: string,
  forceRefresh = false
): Promise<{ content: string; generatedAt: Date; cached: boolean }> {
  if (!forceRefresh) {
    const existing = await getReflectionInsight(userId, period, periodKey);
    if (existing?.content) {
      return { content: existing.content, generatedAt: existing.generatedAt, cached: true };
    }
  }
  const { content } = await generateInsight(userId, period, periodKey);
  return { content, generatedAt: new Date(), cached: false };
}
