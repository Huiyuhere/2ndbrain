# 2nd Brain TODO

## Database Backend Migration
- [x] Add backend/db/user features via webdev_add_feature
- [x] Design database schema for all entities (users, profiles, categories, tasks, habits, habit_completions, goals, roadmap_projects, mood_entries, evening_entries, reflections)
- [x] Push schema to TiDB database (11 tables created)
- [x] Write server/db.ts with full query helpers for all entities
- [x] Write server/routers.ts with full tRPC API (profile, categories, tasks, habits, goals, roadmap, mood, evening, reflections, sync)
- [x] Migrate AppContext from localStorage to database-backed API calls with optimistic updates
- [x] Add login gate in App.tsx for unauthenticated users
- [x] Add loading state while data syncs from DB
- [x] Write and pass vitest tests for all routers (18 tests passing)

## Shared Workspace
- [x] Replace per-user data isolation with a single shared workspace (all authenticated users read/write the owner's data)
- [x] Add workspaceOwnerId to tRPC context, resolved from OWNER_OPEN_ID env var with 60s retry cache
- [x] Update all 25 tRPC data procedures to use workspaceOwnerId instead of ctx.user.id
- [x] Add workspaceProcedure middleware that guards all data routes
- [x] Keep auth gate (must be signed in to access), but remove per-user data partitioning
- [x] Update all 18 vitest tests to reflect shared workspace model (all pass)

## Bug: Morning check-in modal reappears every visit
- [x] Diagnose why moodEntry for today isn't recognized after loadAll
- [x] Migrated mobile data (userId=150007) to shared workspace owner (userId=1)
- [x] Fixed Board.tsx: showCheckin now waits for `loading=false` before deciding, and respects in-session dismissal
- [x] Superseded by Fully Public Dashboard work below

## Email Allowlist (private dashboard for tuhuiyu@manus.ai + t.reneehuiyu@gmail.com)
- [x] Add ALLOWED_EMAILS env-driven allowlist middleware in server/_core/trpc.ts
- [x] Update workspaceProcedure to chain requireUser → requireAllowedEmail → requireWorkspace
- [x] Update tests to use an allowlisted email (all 18 pass)
- [x] Superseded by Fully Public Dashboard (no auth needed)

## Fully Public Dashboard (no auth at all) - COMPLETED
- [x] Server: workspaceProcedure is now public (no auth required)
- [x] Server: hardcoded workspaceOwnerId=1 fallback in context
- [x] Client: removed login gate from App.tsx
- [x] Client: removed useAuth dependency from AppContext, data loads on mount
- [x] Client: removed all `if (user)` gates from mutations
- [x] All 18 vitest tests pass
- [x] Dev preview verified: dashboard loads with data, no login, no modal
- [x] Awaiting user click on Publish button (one-click action in Management UI)

## Journal Backfill — Add from Journal page
- [x] Add "+ Backdate" button in Journal page topbar
- [x] Modal with full date picker (capped at today, no future dates)
- [x] Morning/Evening toggle inside modal — full forms (mood, sleep, intention, focus / location, title, rating, highlights, free write)
- [x] Pre-fills with existing entry if one exists for that date
- [x] Amber warning when overwriting existing entry
- [x] Date format updates label as date changes
- [x] TypeScript clean, 18/18 tests pass

## Journal Backfill (2 days back) — Today page
- [x] Add Today/Yesterday/2-days-ago pills above Morning/Evening tabs in Today.tsx
- [x] Bind existingMood/existingEvening lookups to selectedDate state
- [x] saveMorning/saveEvening write `date: selectedDate`
- [x] useEffect refreshes form fields when selectedDate or loaded entries change
- [x] Unsaved-changes confirm dialog before switching dates
- [x] Subtle amber hint banner when not on today
- [x] Green dot indicator on pills that already have an entry
- [x] GoalBanner / streak / morning check-in modal logic untouched (today-only)
- [x] TypeScript: 0 errors. All 18 vitest tests still pass.

## GitHub sync (Huiyuhere/2ndbrain → current project)
- [x] Profile.tsx: full avatar upload UX — file picker, preview, upload spinner, 5 MB limit, char counters, autoFocus
- [x] Settings.tsx: profile card is now clickable and navigates to /profile
- [x] server/routers.ts: uploadAvatar mutation (base64 → S3 → updateProfile)
- [x] server/db.ts: deleteMoodEntry() helper added
- [x] drizzle migration 0001: JSON column types already applied in DB; migration file + journal synced
- [x] TypeScript clean, 18/18 tests pass

## Evening Mood → Emoji Picker
- [x] Replace star rating with 5-emoji mood picker in Today.tsx evening form
- [x] Replace star rating with emoji picker in JournalViewer.tsx backdate modal
- [x] Update evening entry card display to show mood emoji instead of stars
- [x] Update Analytics.tsx to aggregate mood from both morning + evening entries per day
- [x] Add moodScore column to drizzle schema + db:push
- [x] TypeScript clean, 18/18 tests pass

## Projects Feature (Gantt)
- [x] Schema: projects table (id, title, color, startDate, endDate, status, userId)
- [x] Schema: project_tasks table (id, projectId, title, startDate, dueDate, status, boardTaskId FK nullable, dependsOn JSON)
- [x] Schema: project_milestones table (id, projectId, title, date, reached)
- [x] Run db:push migration
- [x] Server: projects.list, create (max 3 active check), update, complete, delete procedures
- [x] Server: projectTasks.list, upsert, delete procedures
- [x] Server: projectMilestones.list, upsert, delete procedures
- [x] Projects page: Gantt chart with horizontal timeline, task bars, milestone diamonds
- [x] Projects page: max 3 active projects — "Add project" disabled/locked when 3 active
- [x] Projects page: 2-month max duration enforced on create/edit
- [x] Projects page: "Complete project" action unlocks a slot
- [x] Projects page: link project task to existing Board task via dropdown
- [x] Projects page: auto-create board task (Week column) when adding new task
- [x] Navigation: add Projects between Calendar and Habits in sidebar (web)
- [x] Navigation: add Projects inside /more on mobile
- [x] App.tsx: /projects route registered
- [x] TypeScript clean, 18/18 tests pass

## Feedback Fixes (Jun 1)
- [x] Remove "Back" buttons on web view (BackButton now has md:hidden — only shows on mobile)
- [x] Add quarterly goal banner inside Projects page (compact GoalBanner below topbar)
- [x] Use pencil/trash icons (same as Roadmap) for edit/delete in Projects
- [x] Fix today's date to use SGT (UTC+8) — getTodayString, getWeekDates, getStreak, Projects today() all use UTC+8 offset
- [x] TypeScript clean, 18/18 tests pass

## Gantt Chart Improvements
- [x] Sort task rows by earliest dueDate ascending (earliest at top)
- [x] SVG dependency arrows between tasks that have dependsOn links (dashed curved lines + arrowheads)
- [x] Add taskId FK to project_milestones schema (nullable) + db:push
- [x] Milestone with taskId shown inline on that task's row (diamond + label below bar)
- [x] Milestone without taskId stays in the standalone Milestones row
- [x] Update add milestone modal to optionally pick a linked task
- [x] Date tick header (6 evenly-spaced labels across project window)
- [x] Progress bar below Gantt aligned with timeline column
- [x] Completed projects collapsed under a <details> toggle
- [x] TypeScript clean, 18/18 tests pass

## Dynamic Dates + Profile Avatar Everywhere
- [x] Fix Board.tsx hardcoded date subtitle → getTodayLabel() (SGT UTC+8)
- [x] Fix Today.tsx hardcoded date subtitle → getTodayLabel() (SGT UTC+8)
- [x] Fix Reflections.tsx hardcoded date subtitle → getTodayLabel() (SGT UTC+8)
- [x] Fix Reflections.tsx TODAY constant → getTodayString() (SGT UTC+8)
- [x] Fix Analytics.tsx hardcoded week subtitle → dynamic SGT week range from getWeekDates()
- [x] Create shared UserAvatar component (shows avatar img if set, else initials from name)
- [x] Wire UserAvatar to Board topbar (replaces hardcoded "TH" circle)
- [x] Wire UserAvatar to Today topbar (replaces hardcoded "TH" circle)
- [x] Wire UserAvatar to SideNav bottom user section + dynamic name
- [x] Wire UserAvatar to Settings.tsx profile card + dynamic name
- [x] TypeScript clean, 18/18 tests pass

## Duration Tag Parsing ([Xh]/[Xm])
- [x] Add parseDurationStr, parseTitleDuration, getTaskMinutes helpers to store.ts
- [x] AppContext.addTask: auto-extract [Xh/m] from title and set task.duration
- [x] AppContext.updateTask: re-parse duration when title is edited
- [x] Calendar: block height proportional to getTaskMinutes (60px = 1h, min 30px)
- [x] Calendar: show clean title (tag stripped) + duration badge on block
- [x] Analytics: completion rate weighted by hours (planned vs completed hours)
- [x] Analytics: "Hours completed / planned" full-width stat card
- [x] Analytics: category pie chart now shows hours (not task count)
- [x] Analytics: habit score uses SGT date (fixes hardcoded 2026-05-31)
- [x] TypeScript clean, 18/18 tests pass

## Double-tap inline edit (TaskCard)
- [x] Double-tap task title → inline input (Enter saves, Esc cancels, blur saves)
- [x] Double-tap subtask text → inline input (Enter saves, Esc cancels, blur saves)
- [x] Title double-tap stops propagation so card doesn't toggle expand
- [x] Empty edit reverts to original; whitespace trimmed
- [x] TypeScript clean, 18/18 tests pass
## Board "Type" Filter
- [x] Add 'type' to focusMode union type in store.ts
- [x] Add 'type' to focusMode enum in drizzle schema + zod inputs (routers.ts); pushed migration
- [x] Add 'type' branch to filterTasksByMode (Type = research/type ids); Work = work+planning; Personal = catch-all
- [x] Add Type filter pill to Board filter bar (Life | Work | Type | Personal); Life shows all
- [x] Update Profile.tsx focusMode label line to handle 'type'
- [x] Add filterTasksByMode unit tests (vitest now includes client/src tests); 23/23 pass
- [x] TypeScript clean, tests pass

## Estimation Tracker + Task-Type Tags
- [x] Schema: add actualMinutes (int, nullable) to tasks table + push
- [x] Schema: add taskType (varchar, nullable) to tasks table + push
- [x] store.ts: add TASK_TYPES list (build, plan, design, create, communication, marketing, social, exercise) + emoji/color map
- [x] store.ts: add autoClassifyTaskType(title) keyword helper
- [x] store.ts: add actualMinutes + taskType to Task type; parseDurationInput, formatMinutes, getEstimationStats, getSleepHabitInsight helpers
- [x] routers.ts + db.ts: persist actualMinutes + taskType on task upsert/update
- [x] AppContext: auto-assign taskType on addTask; updateTask supports actualMinutes/taskType
- [x] Completion pop-up: ActualTimeModal asks "How long did it take?" when a task newly enters Done (checkbox + drag-to-Done both trigger it); Save logs actualMinutes, Skip dismisses; live over/under preview
- [x] TaskCard: task-type tag chip + editable picker popover (build/plan/design/etc.), '+ type' when unset, Clear option; also shows logged actual time
- [x] Analytics: Estimation Accuracy section — horizontal bar chart of % over/under per task type + per-type breakdown rows; insight card names most over/under-estimated type
- [x] Analytics + Habits: replaced hardcoded "40% more after 7h sleep" with real getSleepHabitInsight (hides/falls back when insufficient data)
- [x] Tests for parseDurationInput, formatMinutes, autoClassifyTaskType, getEstimationStats, getSleepHabitInsight (estimation.test.ts)
- [x] TypeScript clean, 38/38 tests pass

## Analytics: Hours by Type vs Category (side by side)
- [x] store.ts: getHoursByType (actual > estimate > 1h fallback), folds untyped into Other
- [x] store.ts: getHoursByCategory with category metadata
- [x] Analytics: two equal-width HoursPanel cards in grid-cols-1 md:grid-cols-2, shared max scale, stack on mobile
- [x] Tests for both aggregation helpers (hoursBreakdown.test.ts)
- [x] TypeScript clean, 41/41 tests pass
- [x] Add "Admin" as a 9th task type (keywords: admin/invoice/tax/paperwork/etc.); appears in picker + Hours by Type

## Calendar: time blocks, recurrence, .ics export, range, edit-button cleanup
- [x] Schema: time_blocks table + recurFreq/recurEndDate on tasks; pushed migration
- [x] db.ts + routers.ts: CRUD for timeBlocks; persist task recurrence; loadAll returns timeBlocks
- [x] AppContext + store.ts: timeBlocks state, addTimeBlock/updateTimeBlock/deleteTimeBlock, occursOn/blocksOnDate/tasksOnDate recurrence helpers
- [x] Calendar day strip: past 2 days · today · next 10 days (default today; today outlined)
- [x] Calendar grid: render time blocks (left lane) + scheduled tasks (right lane), tap empty slot to create, tap block to edit
- [x] Time block editor (TimeBlockModal): title + start/end + optional category + type + repeat + delete
- [x] Recurring tasks: Repeat control (Doesn't repeat/Daily/Weekly + Until date) in task detail; occurrences expand on Calendar with ↻ marker
- [x] Recurring time blocks: same repeat options in TimeBlockModal; expand across range
- [x] .ics export: Export button downloads iCalendar (timed VEVENTs, all-day for untimed tasks, RRULE+UNTIL for recurrence)
- [x] Remove "Edit" button from task detail panel (Delete kept full-width; title/fields stay inline-editable)
- [x] Tests for recurrence (occursOn/blocksOnDate/tasksOnDate) + .ics (buildICS) + smart duration; 57/57 pass; tsc clean
- [x] Fixed brain.routers test mock to include new db helpers
- [x] Calendar scheduling modal: auto-infer/preselect duration from [Xh]/[Xm] bracket in title (adds custom chip when not a preset)

## Quote of the Day + Monthly Reflection Insights
- [ ] store.ts: curated QUOTES list + getQuoteOfDay() deterministic by calendar day
- [ ] Replace big Q2 banner with QuoteBanner on Board, Today, Habits (Q2 goal stays in sidebar)
- [ ] Backend: tRPC procedure to generate monthly reflection insights via LLM (combines tasks/estimation, mood, sleep/habits, journal/reflections)
- [ ] Cache insights per month (schema table) so it isn't re-billed on every open
- [ ] Reflections Month view: "Show this month's insights" panel above the monthly reflection entry
- [ ] Tests (getQuoteOfDay determinism, insights data assembly); tsc clean; checkpoint

## Quote of the Day + Reflection Insights (monthly + quarterly)
- [ ] store.ts: curated QUOTES list + getQuoteOfDay() deterministic by calendar day
- [ ] Replace big Q2 banner with QuoteBanner on Board, Today, Habits (Q2 goal stays in sidebar)
- [ ] Backend: tRPC procedure to generate reflection insights via LLM for a given period (month/quarter), combining tasks/estimation, mood, sleep/habits, journal/reflections
- [ ] Cache insights per period (schema table keyed by period type+key) so it isn't re-billed on every open
- [ ] Reflections Month view: "Show this month's insights" panel above the monthly reflection entry
- [ ] Reflections Quarter view: "Show this quarter's insights" panel above the quarterly reflection entry
- [ ] Tests (getQuoteOfDay determinism, period range + insights data assembly); tsc clean; checkpoint
- [ ] Insights tone: "CEO mentor" — direct, calls out leaky buckets/excuses, ends with non-negotiable orders (grounded in real data only)

## Google Calendar Two-Way Sync

- [x] Phase 1: DB schema — google_tokens, google_calendar_events, google_sync_calendars tables; googleEventId on time_blocks and tasks
- [x] Phase 2: server/googleCalendar.ts — token management, push event, delete event, pull events, list calendars
- [x] Phase 3: OAuth connect/disconnect tRPC procedures (googleCalendar.status, saveTokens, disconnect, listCalendars)
- [x] Phase 4: Push wiring — timeBlocks.upsert/delete and tasks.upsert/delete call push/delete on Google
- [x] Phase 5: Pull — googleCalendar.sync mutation and getMirrorEvents query
- [x] Phase 6: Calendar UI — mirror events layer (read-only, G badge) and Sync Google button
- [x] Phase 7: Settings page — Google Calendar integration card (connect/disconnect, calendar selector, last synced)
- [x] Phase 8: Tests, checkpoint, delivery
