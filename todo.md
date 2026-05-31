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
