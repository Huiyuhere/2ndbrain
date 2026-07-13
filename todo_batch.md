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


## Insights: default to last COMPLETED period (Mon–Sun) + persist with reflection
- [x] insights.ts: week math already Mon–Sun (ISO week, Monday start)
- [x] insights.ts: added getLastCompletedPeriodKey for week/month/quarter
- [x] InsightPanel/Reflections: default to last completed period (routers default to getLastCompletedPeriodKey)
- [x] Show latest stored insight by default (preload cached via insights.get on mount)
- [x] Persist AI recap tied to completed periodKey; regenerate overwrites
- [x] scheduledInsights.ts: weekly Sunday reviews just-ended week; monthly/quarterly last-day guard reviews ending period (already correct)
- [x] Reflections context banner now shows the last-completed period label (server-aligned)
- [x] Prettified weekly label (8–14 Jun 2026); reframed prompt for a completed period
- [x] Update insights.test.ts for Mon–Sun + last-completed-period helpers (21 tests)
- [x] tsc clean + 78/78 tests pass + checkpoint


## Ask Manus — grounded analytics chat (under Analytics)
- [x] server/askManus.ts: buildAnalyticsSnapshot(userId) — all-time totals + weekday breakdowns + by-type + estimation + sleep-vs-completion + habits + goals + recent mood/sleep + journal frequency (default 90d window, all-time aggregates)
- [x] server/askManus.ts: strict no-hallucination system prompt; answerQuestion(userId, messages) using invokeLLM with the snapshot
- [x] routers.ts: askManus.ask protected mutation (input: messages[]); returns assistant answer
- [x] Chat UI: client/src/pages/AskManus.tsx (ephemeral history, starter prompts, markdown via Streamdown)
- [x] Analytics page: added "✨ Ask Manus" button (top of page) that navigates to /analytics/ask (or opens chat)
- [x] Registered route /analytics/ask in App.tsx with BackButton to Analytics
- [x] server/askManus.test.ts: snapshot aggregation unit tests (9, refactored computeSnapshot pure fn)
- [x] tsc clean + 87/87 tests pass + browser verified (grounded, hedged sleep answer) + checkpoint

## Bug fixes — Ask Manus journal + weekly recap period
- [x] askManus.ts: include recent journal entry TEXT content (last 30 entries) in the snapshot so AI can reference what user wrote
- [x] askManus.ts: include recent reflection answers (last 10) in the snapshot
- [x] Fix weekly recap period: on Sunday, current week IS the completed week (7–13 Jul = W28)
- [x] Fix monthly: on last day of month, current month is the completed one
- [x] Fix quarterly: on last day of quarter, current quarter is the completed one
- [x] Updated insights.test.ts + askManus.test.ts (93/93 pass)
- [x] insights.ts + askManus.ts: include projects data (active/completed) in both data briefs
- [x] Weekly cron moved to Monday 01:00 UTC (09:00 SGT) so all Sunday data is captured before generation
- [x] scheduledInsights.ts: weekly now uses getLastCompletedPeriodKey (fires Monday, reviews previous Mon–Sun)
- [x] tsc clean + 93/93 tests pass
