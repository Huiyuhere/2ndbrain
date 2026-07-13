/**
 * Scheduled (Heartbeat) handler for auto-generating Reflection Insights.
 *
 * Mounted at POST /api/scheduled/insights (see server/_core/index.ts).
 *
 * Three project-level crons fire this endpoint:
 *   - weekly:    every Monday 01:00 UTC (09:00 SGT) → reviews previous Mon–Sun
 *   - monthly:   every day 09:00 UTC, guarded to the last day of the month
 *   - quarterly: every day 09:00 UTC, guarded to the last day of a quarter
 *
 * The payload tells us which period to generate: { "period": "weekly" | "monthly" | "quarterly" }.
 * For monthly/quarterly we run daily and self-guard so we only act on the true
 * last day, which avoids brittle day-of-month cron math across month lengths.
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getWorkspaceOwnerId } from "./_core/context";
import { notifyOwner } from "./_core/notification";
import { generateInsight, getPeriodKey, getLastCompletedPeriodKey, getPeriodLabel, type Period } from "./insights";

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

function sgtNow(): Date {
  return new Date(Date.now() + SGT_OFFSET_MS);
}

/** Is `d` (SGT) the last day of its month? */
function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 1);
  return next.getUTCMonth() !== d.getUTCMonth();
}

/** Is `d` (SGT) the last day of a calendar quarter? */
function isLastDayOfQuarter(d: Date): boolean {
  const month = d.getUTCMonth(); // 0-based
  const isQuarterEndMonth = month === 2 || month === 5 || month === 8 || month === 11;
  return isQuarterEndMonth && isLastDayOfMonth(d);
}

/**
 * The period KEY we should generate for at trigger time.
 * Weekly fires on Monday morning and reviews the previous Mon–Sun week.
 * Monthly/quarterly fire on the last day and review the current (just-finished) period.
 */
function periodKeyForTrigger(period: Period, now: Date): string {
  if (period === "weekly") {
    // Monday morning → getLastCompletedPeriodKey returns previous Mon–Sun
    return getLastCompletedPeriodKey(period, now);
  }
  return getPeriodKey(period, now);
}

function firstHeadingSummary(markdown: string): string {
  // Pull the bold one-line verdict (first **...** line) for the notification body.
  const boldMatch = markdown.match(/\*\*(.+?)\*\*/);
  if (boldMatch) return boldMatch[1].trim();
  const firstLine = markdown.split("\n").find(l => l.trim() && !l.trim().startsWith("#"));
  return (firstLine ?? "Your review is ready.").replace(/[*_#]/g, "").slice(0, 180);
}

export async function scheduledInsightsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const body = (req.body ?? {}) as { period?: string };
    const period = body.period as Period | undefined;
    if (period !== "weekly" && period !== "monthly" && period !== "quarterly") {
      return res.status(400).json({ error: "invalid-or-missing-period" });
    }

    const now = sgtNow();

    // Self-guard for daily-fired monthly/quarterly crons.
    if (period === "monthly" && !isLastDayOfMonth(now)) {
      return res.json({ ok: true, skipped: "not-last-day-of-month" });
    }
    if (period === "quarterly" && !isLastDayOfQuarter(now)) {
      return res.json({ ok: true, skipped: "not-last-day-of-quarter" });
    }

    const ownerId = await getWorkspaceOwnerId();
    const periodKey = periodKeyForTrigger(period, now);

    const { content } = await generateInsight(ownerId, period, periodKey);
    if (!content) {
      return res.status(500).json({ error: "empty-generation", period, periodKey });
    }

    const label = getPeriodLabel(period, periodKey);
    const title = `Your ${period} review is ready — ${label}`;
    const summary = firstHeadingSummary(content);
    await notifyOwner({
      title,
      content: `${summary}\n\nOpen Reflections → ${period} to read the full CEO-mentor review.`,
    });

    return res.json({ ok: true, period, periodKey });
  } catch (err) {
    const e = err as Error;
    return res.status(500).json({
      error: e.message,
      stack: e.stack,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
