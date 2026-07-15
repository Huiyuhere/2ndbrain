/**
 * Scheduled (Heartbeat) handler for pulling Google Calendar events.
 *
 * Mounted at POST /api/scheduled/google-sync (see server/_core/index.ts).
 *
 * A project-level cron fires this every 15 minutes:
 *   cron: "0 0/15 * * * *"
 *
 * It pulls events from all enabled Google calendars for connected users
 * and upserts them into the google_calendar_events mirror table.
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getWorkspaceOwnerId } from "./_core/context";
import { pullEventsFromGoogle } from "./googleCalendar";
import { getGoogleConnectionStatus } from "./googleCalendar";

export async function scheduledGoogleSyncHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const ownerId = await getWorkspaceOwnerId();
    const { connected } = await getGoogleConnectionStatus(ownerId);

    if (!connected) {
      return res.json({ ok: true, skipped: "not-connected" });
    }

    const count = await pullEventsFromGoogle(ownerId, 60);
    return res.json({ ok: true, count });
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
