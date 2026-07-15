/**
 * Google Calendar API helper module.
 *
 * Handles:
 *  - OAuth2 client construction + token refresh
 *  - Pushing 2nd Brain time blocks / scheduled tasks to Google Calendar
 *  - Deleting events from Google Calendar
 *  - Pulling external Google Calendar events into the mirror table
 *  - Listing the user's Google calendars for the Settings selector
 *
 * All functions are server-side only. Tokens are stored in the google_tokens table.
 */

import { google } from "googleapis";
import { getDb } from "./db";
import {
  googleTokens,
  googleCalendarEvents,
  googleSyncCalendars,
  GoogleTokenRow,
  GoogleCalendarEventRow,
  GoogleSyncCalendarRow,
} from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEventInput = {
  title: string;
  date: string;       // YYYY-MM-DD
  startMin?: number | null;  // minutes from midnight; null/undefined = all-day
  endMin?: number | null;
  description?: string;
};

export type MirrorEvent = {
  id: string;
  googleCalendarId: string;
  googleEventId: string;
  title: string;
  date: string;
  startMin: number | null;
  endMin: number | null;
  endDate: string | null;
  description: string | null;
  colorHex: string | null;
  calendarName: string | null;
};

export type GoogleCalendarInfo = {
  id: string;
  name: string;
  colorHex: string | null;
  primary: boolean;
};

// ─── Google color ID → hex mapping ───────────────────────────────────────────

const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

// ─── OAuth2 client ────────────────────────────────────────────────────────────

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || "placeholder",
    process.env.GOOGLE_CLIENT_SECRET || "placeholder",
    process.env.GOOGLE_REDIRECT_URI || "postmessage"
  );
}

/**
 * Load the user's stored tokens, build an authenticated OAuth2 client,
 * and auto-refresh if the access token is near expiry. Saves the refreshed
 * token back to the DB. Returns null if the user has not connected Google Calendar.
 */
export async function getGoogleClient(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  const tokenRow = rows[0] as GoogleTokenRow | undefined;
  if (!tokenRow) return null;

  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.expiresAt,
  });

  // Auto-refresh if expired or within 5 min of expiry
  const nowMs = Date.now();
  if (tokenRow.expiresAt - nowMs < 5 * 60 * 1000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      const newExpiry = credentials.expiry_date ?? nowMs + 3600 * 1000;
      await db
        .update(googleTokens)
        .set({
          accessToken: credentials.access_token ?? tokenRow.accessToken,
          expiresAt: newExpiry,
        })
        .where(eq(googleTokens.userId, userId));
      oauth2.setCredentials(credentials);
    } catch (err) {
      console.error("[GoogleCalendar] Token refresh failed:", err);
      return null;
    }
  }

  return oauth2;
}

// ─── Push: 2nd Brain → Google ─────────────────────────────────────────────────

function minToRFC3339(date: string, min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Create or update a Google Calendar event on the user's primary calendar.
 * Pass existingGoogleEventId to update; omit to create.
 * Returns the Google event ID, or null on failure.
 */
export async function pushEventToGoogle(
  userId: number,
  event: CalendarEventInput,
  existingGoogleEventId?: string | null
): Promise<string | null> {
  const auth = await getGoogleClient(userId);
  if (!auth) return null;

  const cal = google.calendar({ version: "v3", auth });
  const isAllDay = event.startMin === undefined || event.startMin === null;

  const resource: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? "",
    ...(isAllDay
      ? {
          start: { date: event.date },
          end: { date: event.date },
        }
      : {
          start: {
            dateTime: minToRFC3339(event.date, event.startMin!),
            timeZone: "Asia/Singapore",
          },
          end: {
            dateTime: minToRFC3339(event.date, event.endMin ?? event.startMin! + 60),
            timeZone: "Asia/Singapore",
          },
        }),
  };

  try {
    if (existingGoogleEventId) {
      const res = await cal.events.update({
        calendarId: "primary",
        eventId: existingGoogleEventId,
        requestBody: resource,
      });
      return res.data.id ?? existingGoogleEventId;
    } else {
      const res = await cal.events.insert({
        calendarId: "primary",
        requestBody: resource,
      });
      return res.data.id ?? null;
    }
  } catch (err) {
    console.error("[GoogleCalendar] pushEventToGoogle failed:", err);
    return null;
  }
}

/**
 * Delete a Google Calendar event by its Google event ID.
 */
export async function deleteEventFromGoogle(
  userId: number,
  googleEventId: string
): Promise<void> {
  const auth = await getGoogleClient(userId);
  if (!auth) return;

  const cal = google.calendar({ version: "v3", auth });
  try {
    await cal.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status !== 410 && status !== 404) {
      console.error("[GoogleCalendar] deleteEventFromGoogle failed:", err);
    }
  }
}

// ─── Pull: Google → 2nd Brain ─────────────────────────────────────────────────

/**
 * Fetch events from the user's enabled Google calendars within a date window
 * and upsert them into the google_calendar_events mirror table.
 * Returns the number of events upserted.
 */
export async function pullEventsFromGoogle(
  userId: number,
  windowDays = 60
): Promise<number> {
  const auth = await getGoogleClient(userId);
  if (!auth) return 0;

  const db = await getDb();
  if (!db) return 0;

  const syncCals = (await db
    .select()
    .from(googleSyncCalendars)
    .where(
      and(eq(googleSyncCalendars.userId, userId), eq(googleSyncCalendars.enabled, true))
    )) as GoogleSyncCalendarRow[];

  if (syncCals.length === 0) return 0;

  const cal = google.calendar({ version: "v3", auth });

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  let total = 0;

  for (const syncCal of syncCals) {
    try {
      const res = await cal.events.list({
        calendarId: syncCal.calendarId,
        timeMin: windowStart.toISOString(),
        timeMax: windowEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
      });

      const events = res.data.items ?? [];

      for (const ev of events) {
        if (!ev.id || ev.status === "cancelled") continue;

        const startDate = ev.start?.date ?? ev.start?.dateTime?.slice(0, 10) ?? "";
        const endDate = ev.end?.date ?? ev.end?.dateTime?.slice(0, 10) ?? null;
        if (!startDate) continue;

        let startMin: number | null = null;
        let endMin: number | null = null;
        if (ev.start?.dateTime) {
          const t = new Date(ev.start.dateTime);
          const localMin = t.getUTCHours() * 60 + t.getUTCMinutes() + 8 * 60; // SGT
          startMin = ((localMin % 1440) + 1440) % 1440;
        }
        if (ev.end?.dateTime) {
          const t = new Date(ev.end.dateTime);
          const localMin = t.getUTCHours() * 60 + t.getUTCMinutes() + 8 * 60;
          endMin = ((localMin % 1440) + 1440) % 1440;
        }

        const colorHex = ev.colorId
          ? (GOOGLE_COLOR_MAP[ev.colorId] ?? null)
          : (syncCal.colorHex ?? null);
        const compositeId = `${syncCal.calendarId}:${ev.id}`;

        await db
          .insert(googleCalendarEvents)
          .values({
            id: compositeId,
            userId,
            googleCalendarId: syncCal.calendarId,
            googleEventId: ev.id,
            title: ev.summary ?? "(No title)",
            date: startDate,
            startMin,
            endMin,
            endDate: endDate !== startDate ? endDate : null,
            description: ev.description ?? null,
            colorHex,
            calendarName: syncCal.calendarName,
          })
          .onDuplicateKeyUpdate({
            set: {
              title: ev.summary ?? "(No title)",
              date: startDate,
              startMin,
              endMin,
              endDate: endDate !== startDate ? endDate : null,
              description: ev.description ?? null,
              colorHex,
              calendarName: syncCal.calendarName,
            },
          });

        total++;
      }
    } catch (err) {
      console.error(
        `[GoogleCalendar] pullEventsFromGoogle failed for calendar ${syncCal.calendarId}:`,
        err
      );
    }
  }

  return total;
}

// ─── List user's Google calendars ─────────────────────────────────────────────

export async function listUserCalendars(userId: number): Promise<GoogleCalendarInfo[]> {
  const auth = await getGoogleClient(userId);
  if (!auth) return [];

  const cal = google.calendar({ version: "v3", auth });
  try {
    const res = await cal.calendarList.list({ minAccessRole: "reader" });
    return (res.data.items ?? []).map((c) => ({
      id: c.id ?? "",
      name: c.summary ?? c.id ?? "",
      colorHex: c.backgroundColor ?? null,
      primary: c.primary ?? false,
    }));
  } catch (err) {
    console.error("[GoogleCalendar] listUserCalendars failed:", err);
    return [];
  }
}

// ─── DB helpers for google_sync_calendars ─────────────────────────────────────

export async function getSyncCalendars(userId: number): Promise<GoogleSyncCalendarRow[]> {
  const db = await getDb();
  if (!db) return [];
  return (await db
    .select()
    .from(googleSyncCalendars)
    .where(eq(googleSyncCalendars.userId, userId))) as GoogleSyncCalendarRow[];
}

export async function upsertSyncCalendar(
  userId: number,
  calendarId: string,
  calendarName: string,
  enabled: boolean,
  colorHex?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ id: googleSyncCalendars.id })
    .from(googleSyncCalendars)
    .where(
      and(
        eq(googleSyncCalendars.userId, userId),
        eq(googleSyncCalendars.calendarId, calendarId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(googleSyncCalendars)
      .set({ calendarName, enabled, colorHex: colorHex ?? null })
      .where(
        and(
          eq(googleSyncCalendars.userId, userId),
          eq(googleSyncCalendars.calendarId, calendarId)
        )
      );
  } else {
    await db.insert(googleSyncCalendars).values({
      userId,
      calendarId,
      calendarName,
      enabled,
      colorHex: colorHex ?? null,
    });
  }
}

// ─── DB helpers for google_tokens ─────────────────────────────────────────────

export async function saveGoogleTokens(
  userId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  scope: string,
  email: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ id: googleTokens.id })
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(googleTokens)
      .set({ accessToken, refreshToken, expiresAt, scope, email })
      .where(eq(googleTokens.userId, userId));
  } else {
    await db.insert(googleTokens).values({
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      email,
    });
  }
}

export async function deleteGoogleTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
  await db.delete(googleCalendarEvents).where(eq(googleCalendarEvents.userId, userId));
  await db.delete(googleSyncCalendars).where(eq(googleSyncCalendars.userId, userId));
}

export async function getGoogleConnectionStatus(
  userId: number
): Promise<{ connected: boolean; email: string | null }> {
  const db = await getDb();
  if (!db) return { connected: false, email: null };

  const rows = await db
    .select({ email: googleTokens.email, expiresAt: googleTokens.expiresAt })
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  const row = rows[0] as Pick<GoogleTokenRow, "email" | "expiresAt"> | undefined;
  return row ? { connected: true, email: row.email ?? null } : { connected: false, email: null };
}

// ─── Query mirror events for a date range ─────────────────────────────────────

export async function getMirrorEventsForRange(
  userId: number,
  startDate: string,
  endDate: string
): Promise<MirrorEvent[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = (await db
    .select()
    .from(googleCalendarEvents)
    .where(
      and(
        eq(googleCalendarEvents.userId, userId),
        gte(googleCalendarEvents.date, startDate),
        lte(googleCalendarEvents.date, endDate)
      )
    )) as GoogleCalendarEventRow[];

  return rows.map((r) => ({
    id: r.id,
    googleCalendarId: r.googleCalendarId,
    googleEventId: r.googleEventId,
    title: r.title,
    date: r.date,
    startMin: r.startMin ?? null,
    endMin: r.endMin ?? null,
    endDate: r.endDate ?? null,
    description: r.description ?? null,
    colorHex: r.colorHex ?? null,
    calendarName: r.calendarName ?? null,
  }));
}
