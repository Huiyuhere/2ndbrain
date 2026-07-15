/**
 * tRPC router for Google Calendar integration.
 *
 * Procedures:
 *  - status: get connection status + email
 *  - saveTokens: store OAuth tokens after user grants access
 *  - disconnect: remove tokens and wipe mirror events
 *  - listCalendars: list the user's Google calendars
 *  - updateSyncCalendars: set which calendars to pull from
 *  - getSyncCalendars: get current sync calendar preferences
 *  - sync: pull events from Google into the mirror table
 *  - getMirrorEvents: query mirrored events for a date range
 */

import { z } from "zod";
import { workspaceProcedure, router } from "../_core/trpc";
import {
  getGoogleConnectionStatus,
  saveGoogleTokens,
  deleteGoogleTokens,
  listUserCalendars,
  getSyncCalendars,
  upsertSyncCalendar,
  pullEventsFromGoogle,
  getMirrorEventsForRange,
} from "../googleCalendar";

export const googleCalendarRouter = router({
  /** Returns whether Google Calendar is connected and which account. */
  status: workspaceProcedure.query(async ({ ctx }) => {
    const userId = ctx.workspaceOwnerId!;
    return getGoogleConnectionStatus(userId);
  }),

  /**
   * Save Google OAuth tokens after the user completes the OAuth flow.
   * The frontend passes the tokens obtained from the Manus Google Calendar connector.
   */
  saveTokens: workspaceProcedure
    .input(
      z.object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresAt: z.number(), // ms since epoch
        scope: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.workspaceOwnerId!;
      await saveGoogleTokens(
        userId,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
        input.scope,
        input.email
      );

      // After connecting, auto-populate the primary calendar as enabled
      const cals = await listUserCalendars(userId);
      for (const cal of cals) {
        if (cal.primary) {
          await upsertSyncCalendar(userId, cal.id, cal.name, true, cal.colorHex);
        }
      }

      return { success: true };
    }),

  /**
   * Exchange a Google OAuth authorisation code for tokens (server-side).
   * Keeps GOOGLE_CLIENT_SECRET off the frontend.
   */
  exchangeCode: workspaceProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ input }) => {
      const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured. Add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Settings → Secrets.');
      }
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: input.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Google token exchange failed: ${detail}`);
      }
      const tokens = await resp.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
        id_token?: string;
      };
      // Decode email from id_token (JWT payload, no verification needed here)
      let email = '';
      if (tokens.id_token) {
        try {
          const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
          email = payload.email ?? '';
        } catch { /* ignore */ }
      }
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        email,
      };
    }),

  /** Disconnect Google Calendar — removes tokens and all mirrored events. */
  disconnect: workspaceProcedure.mutation(async ({ ctx }) => {
    await deleteGoogleTokens(ctx.workspaceOwnerId!);
    return { success: true };
  }),

  /** List all Google calendars the connected account has access to. */
  listCalendars: workspaceProcedure.query(async ({ ctx }) => {
    return listUserCalendars(ctx.workspaceOwnerId!);
  }),

  /** Get the current sync calendar preferences (which calendars are enabled for pull). */
  getSyncCalendars: workspaceProcedure.query(async ({ ctx }) => {
    return getSyncCalendars(ctx.workspaceOwnerId!);
  }),

  /** Update which Google calendars to pull events from. */
  updateSyncCalendars: workspaceProcedure
    .input(
      z.array(
        z.object({
          calendarId: z.string(),
          calendarName: z.string(),
          enabled: z.boolean(),
          colorHex: z.string().nullable().optional(),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.workspaceOwnerId!;
      for (const cal of input) {
        await upsertSyncCalendar(
          userId,
          cal.calendarId,
          cal.calendarName,
          cal.enabled,
          cal.colorHex
        );
      }
      return { success: true };
    }),

  /**
   * Pull events from Google Calendar into the mirror table.
   * Returns the number of events synced.
   */
  sync: workspaceProcedure
    .input(z.object({ windowDays: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.workspaceOwnerId!;
      const count = await pullEventsFromGoogle(userId, input?.windowDays ?? 60);
      return { success: true, count };
    }),

  /** Get mirrored Google Calendar events for a date range. */
  getMirrorEvents: workspaceProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      return getMirrorEventsForRange(ctx.workspaceOwnerId!, input.startDate, input.endDate);
    }),
});
