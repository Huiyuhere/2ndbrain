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
