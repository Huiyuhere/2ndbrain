# Batch: Quote banner + Reflection Insights (W/M/Q) + Repeat fix

## Repeat fix
- [x] Task Repeat control: Done + Cancel buttons; Cancel clears recurrence and closes panel; tsc 0 errors

## Quote of the Day
- [x] lib/quotes.ts: curated QUOTES list + getQuoteOfDay() deterministic by calendar day
- [x] QuoteBanner component (blue banner styling, Playfair italic)
- [x] Board: replaced big Q2 banner with QuoteBanner
- [x] Today: QuoteBanner added above the daily-intention strip (intention kept)
- [x] Habits: replaced compact Q2 strip with QuoteBanner; Q2 goal stays in sidebar (SideNav)

## Reflection Insights backend
- [x] Schema: reflection_insights table (period enum, periodKey, content md, generatedAt) + pushed (migration 0008)
- [x] db.ts: getReflectionInsight + upsertReflectionInsight helpers
- [x] insights.ts: period-key + range helpers (SGT/ISO-week), data aggregator (tasks/estimation, mood, sleep, habits, journal-gaps, goals, reflections)
- [x] routers.ts: insights.get (cached) + insights.generate (cache or refresh) procedures
- [x] Prompt: CEO-mentor voice, emoji per header, bold verdict, goal check-in, overpromising + admin avoidance + missing-journal callouts; grounded in data only; depth scales weekly<monthly<quarterly; ends with non-negotiable orders
- [x] Verified end-to-end via dev tRPC: real weekly review generated grounded in data

## Reflections UI
- [x] InsightPanel component: collapsed "✨ Show this period's insights" button; generate/cache on open; loading state
- [x] Renders markdown via Streamdown, mobile-optimised prose
- [x] 📥 Download as Markdown + ↻ Regenerate + generatedAt timestamp
- [x] Slotted into Reflections above the entry form for all three tabs (weekly/monthly/quarterly)

## Scheduled auto-generation
- [x] /api/scheduled/insights Heartbeat handler (auth via sdk, isCron guard, period payload)
- [x] Monthly/quarterly self-guard to true last day (handles month lengths/leap years)
- [x] Generates insight + notifyOwner "Your <period> review is ready"
- [x] Mounted in index.ts before Vite/static fallthrough
- [x] Created 3 project-level crons via manus-heartbeat (weekly Sun, monthly daily, quarterly daily — all 09:00 UTC = SGT 17:00); all enabled, next run 2026-06-14T09:00Z
- [x] Verified production endpoint reachable + auth-guarded (403 to non-cron)

## Wrap
- [x] Tests: 70/70 pass (13 new insights tests); tsc 0 errors
- [x] Checkpoint saved + user deployed; crons registered against production URL
