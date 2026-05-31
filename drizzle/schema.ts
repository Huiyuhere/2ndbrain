import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Core auth table ────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User profile ────────────────────────────────────────────────────────────

export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  name: varchar("name", { length: 255 }),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  avatarKey: text("avatarKey"),
  focusMode: mysqlEnum("focusMode", ["life", "work", "personal"]).default("life").notNull(),
  monthlyIntention: text("monthlyIntention"),
  quarterlyGoalText: text("quarterlyGoalText"),
  quarterlyGoalProgress: int("quarterlyGoalProgress").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfileRow = typeof userProfiles.$inferSelect;

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  bgColor: varchar("bgColor", { length: 20 }).notNull(),
  textColor: varchar("textColor", { length: 20 }).notNull(),
  keywords: json("keywords").$type<string[]>(),
  sortOrder: int("sortOrder").default(0),
});

export type CategoryRow = typeof categories.$inferSelect;

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  categoryId: varchar("categoryId", { length: 64 }).notNull().default("work"),
  column: mysqlEnum("column", ["ideas", "future", "week", "today", "done"]).notNull().default("ideas"),
  duration: varchar("duration", { length: 20 }),
  scheduledTime: varchar("scheduledTime", { length: 10 }),
  scheduledDate: varchar("scheduledDate", { length: 10 }),
  subtasks: json("subtasks").$type<{ id: string; title: string; done: boolean }[]>(),
  links: json("links").$type<{ label: string; url: string }[]>(),
  notes: text("notes"),
  createdAt: varchar("createdAt", { length: 10 }).notNull(),
  completedAt: varchar("completedAt", { length: 10 }),
});

export type TaskRow = typeof tasks.$inferSelect;

// ─── Habits ───────────────────────────────────────────────────────────────────

export const habits = mysqlTable("habits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  sortOrder: int("sortOrder").default(0),
});

export type HabitRow = typeof habits.$inferSelect;

export const habitCompletions = mysqlTable("habit_completions", {
  id: int("id").autoincrement().primaryKey(),
  habitId: varchar("habitId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
});

export type HabitCompletionRow = typeof habitCompletions.$inferSelect;

// ─── Goals ────────────────────────────────────────────────────────────────────

export const goals = mysqlTable("goals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  categoryId: varchar("categoryId", { length: 64 }).notNull().default("work"),
  progress: int("progress").default(0),
  current: varchar("current", { length: 100 }),
  target: varchar("target", { length: 100 }),
  dueDate: varchar("dueDate", { length: 10 }),
  done: boolean("done").default(false),
  sortOrder: int("sortOrder").default(0),
});

export type GoalRow = typeof goals.$inferSelect;

// ─── Roadmap projects ─────────────────────────────────────────────────────────

export const roadmapProjects = mysqlTable("roadmap_projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  startMonth: int("startMonth").notNull().default(0),
  endMonth: int("endMonth").notNull().default(11),
  progress: int("progress").default(0),
  milestones: json("milestones").$type<{ month: number; label: string }[]>(),
  goalType: mysqlEnum("goalType", ["numerical", "milestone"]).default("milestone"),
  targetValue: int("targetValue"),
  currentValue: int("currentValue"),
  sortOrder: int("sortOrder").default(0),
});

export type RoadmapProjectRow = typeof roadmapProjects.$inferSelect;

// ─── Morning check-ins (mood entries) ────────────────────────────────────────

export const moodEntries = mysqlTable("mood_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  mood: float("mood").notNull().default(3),
  sleep: float("sleep").notNull().default(7),
  intention: text("intention"),
  focus: text("focus"),
});

export type MoodEntryRow = typeof moodEntries.$inferSelect;

// ─── Evening journal entries ──────────────────────────────────────────────────

export const eveningEntries = mysqlTable("evening_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  location: varchar("location", { length: 255 }),
  title: varchar("title", { length: 255 }),
  rating: int("rating").default(5),
  highlights: json("highlights").$type<{ type: "+" | "-"; text: string }[]>(),
  freeWrite: text("freeWrite"),
  photoUrl: text("photoUrl"),
});

export type EveningEntryRow = typeof eveningEntries.$inferSelect;

// ─── Reflections ──────────────────────────────────────────────────────────────

export const reflections = mysqlTable("reflections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["weekly", "monthly", "quarterly"]).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  answers: json("answers").$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReflectionRow = typeof reflections.$inferSelect;
