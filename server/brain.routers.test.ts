/**
 * Tests for 2nd Brain tRPC routers.
 * These tests use the router caller pattern with mocked DB helpers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock all DB helpers before importing the router
vi.mock("./db", () => ({
  getOrCreateProfile: vi.fn().mockResolvedValue({
    id: 1, userId: 1, name: "Test User", bio: "", avatarUrl: null, avatarKey: null,
    focusMode: "life", monthlyIntention: null, quarterlyGoalText: null,
    quarterlyGoalProgress: 0, updatedAt: new Date(),
  }),
  updateProfile: vi.fn().mockResolvedValue(undefined),
  getCategories: vi.fn().mockResolvedValue([]),
  upsertCategories: vi.fn().mockResolvedValue(undefined),
  getTasks: vi.fn().mockResolvedValue([]),
  upsertTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  getHabits: vi.fn().mockResolvedValue({ habits: [], completions: [] }),
  upsertHabit: vi.fn().mockResolvedValue(undefined),
  deleteHabit: vi.fn().mockResolvedValue(undefined),
  toggleHabitCompletion: vi.fn().mockResolvedValue(true),
  getGoals: vi.fn().mockResolvedValue([]),
  upsertGoal: vi.fn().mockResolvedValue(undefined),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
  getRoadmapProjects: vi.fn().mockResolvedValue([]),
  upsertRoadmapProject: vi.fn().mockResolvedValue(undefined),
  deleteRoadmapProject: vi.fn().mockResolvedValue(undefined),
  getMoodEntries: vi.fn().mockResolvedValue([]),
  upsertMoodEntry: vi.fn().mockResolvedValue(undefined),
  getEveningEntries: vi.fn().mockResolvedValue([]),
  upsertEveningEntry: vi.fn().mockResolvedValue(undefined),
  getReflections: vi.fn().mockResolvedValue([]),
  upsertReflection: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("profile router", () => {
  it("get: returns profile for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profile.get();
    expect(result).toMatchObject({ userId: 1, name: "Test User" });
    expect(db.getOrCreateProfile).toHaveBeenCalledWith(1);
  });

  it("update: saves profile fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profile.update({ name: "New Name", focusMode: "work" });
    expect(result).toEqual({ success: true });
    expect(db.updateProfile).toHaveBeenCalledWith(1, { name: "New Name", focusMode: "work" });
  });
});

describe("tasks router", () => {
  it("list: returns tasks for user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.list();
    expect(Array.isArray(result)).toBe(true);
    expect(db.getTasks).toHaveBeenCalledWith(1);
  });

  it("upsert: saves a task", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.upsert({
      id: "task-1", title: "Test task", categoryId: "work",
      column: "today", createdAt: "2026-05-31",
    });
    expect(result).toEqual({ success: true });
    expect(db.upsertTask).toHaveBeenCalledWith(1, expect.objectContaining({ id: "task-1", title: "Test task" }));
  });

  it("delete: removes a task", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.delete({ id: "task-1" });
    expect(result).toEqual({ success: true });
    expect(db.deleteTask).toHaveBeenCalledWith(1, "task-1");
  });
});

describe("habits router", () => {
  it("list: returns habits and completions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.habits.list();
    expect(result).toMatchObject({ habits: [], completions: [] });
  });

  it("upsert: saves a habit", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.habits.upsert({ id: "h1", name: "Exercise", emoji: "🏃" });
    expect(result).toEqual({ success: true });
    expect(db.upsertHabit).toHaveBeenCalledWith(1, expect.objectContaining({ id: "h1", name: "Exercise" }));
  });

  it("toggle: toggles habit completion", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.habits.toggle({ habitId: "h1", date: "2026-05-31" });
    expect(result).toEqual({ checked: true });
    expect(db.toggleHabitCompletion).toHaveBeenCalledWith(1, "h1", "2026-05-31");
  });

  it("delete: removes a habit", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.habits.delete({ id: "h1" });
    expect(result).toEqual({ success: true });
    expect(db.deleteHabit).toHaveBeenCalledWith(1, "h1");
  });
});

describe("goals router", () => {
  it("list: returns goals for user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.goals.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("upsert: saves a goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.goals.upsert({
      id: "g1", title: "Grow TikTok", categoryId: "planning",
      progress: 24, done: false,
    });
    expect(result).toEqual({ success: true });
    expect(db.upsertGoal).toHaveBeenCalledWith(1, expect.objectContaining({ id: "g1", title: "Grow TikTok" }));
  });

  it("delete: removes a goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.goals.delete({ id: "g1" });
    expect(result).toEqual({ success: true });
    expect(db.deleteGoal).toHaveBeenCalledWith(1, "g1");
  });
});

describe("mood router", () => {
  it("list: returns mood entries", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mood.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("save: saves a mood entry", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mood.save({ date: "2026-05-31", mood: 4, sleep: 7.5 });
    expect(result).toEqual({ success: true });
    expect(db.upsertMoodEntry).toHaveBeenCalledWith(1, expect.objectContaining({ date: "2026-05-31", mood: 4 }));
  });
});

describe("reflections router", () => {
  it("list: returns reflections", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reflections.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("save: saves a reflection", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reflections.save({
      id: "r1", type: "weekly", date: "2026-05-31",
      answers: { q1: "I learned a lot" },
    });
    expect(result).toEqual({ success: true });
    expect(db.upsertReflection).toHaveBeenCalledWith(1, expect.objectContaining({ id: "r1", type: "weekly" }));
  });
});

describe("sync router", () => {
  it("loadAll: returns all data for user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.loadAll();
    expect(result).toMatchObject({
      profile: expect.objectContaining({ userId: 1 }),
      categories: [],
      tasks: [],
      habits: [],
      habitCompletions: [],
      goals: [],
      roadmapProjects: [],
      moodEntries: [],
      eveningEntries: [],
      reflections: [],
    });
  });
});
