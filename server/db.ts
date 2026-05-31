import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  eveningEntries,
  goals,
  habitCompletions,
  habits,
  InsertUser,
  moodEntries,
  reflections,
  roadmapProjects,
  tasks,
  userProfiles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(userProfiles).values({ userId });
  const created = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return created[0] ?? null;
}

export async function updateProfile(userId: number, data: Partial<typeof userProfiles.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  // Upsert: insert if no row, update if exists. userId has UNIQUE constraint.
  await db.insert(userProfiles)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function upsertCategories(userId: number, cats: (typeof categories.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;
  // Delete all and re-insert for simplicity (categories list is small)
  await db.delete(categories).where(eq(categories.userId, userId));
  if (cats.length > 0) {
    await db.insert(categories).values(cats.map(c => ({ ...c, userId })));
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId));
}

export async function upsertTask(userId: number, task: typeof tasks.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(tasks).values({ ...task, userId }).onDuplicateKeyUpdate({
    set: {
      title: task.title,
      categoryId: task.categoryId,
      column: task.column,
      duration: task.duration ?? null,
      scheduledTime: task.scheduledTime ?? null,
      scheduledDate: task.scheduledDate ?? null,
      subtasks: task.subtasks ?? null,
      links: task.links ?? null,
      notes: task.notes ?? null,
      completedAt: task.completedAt ?? null,
    },
  });
}

export async function deleteTask(userId: number, taskId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export async function getHabits(userId: number) {
  const db = await getDb();
  if (!db) return { habits: [], completions: [] };
  const [h, c] = await Promise.all([
    db.select().from(habits).where(eq(habits.userId, userId)),
    db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)),
  ]);
  return { habits: h, completions: c };
}

export async function upsertHabit(userId: number, habit: typeof habits.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(habits).values({ ...habit, userId }).onDuplicateKeyUpdate({
    set: { name: habit.name, emoji: habit.emoji, sortOrder: habit.sortOrder ?? 0 },
  });
}

export async function deleteHabit(userId: number, habitId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(habits).where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
  await db.delete(habitCompletions).where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.userId, userId)));
}

export async function toggleHabitCompletion(userId: number, habitId: string, date: string) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(habitCompletions)
    .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.userId, userId), eq(habitCompletions.date, date)))
    .limit(1);
  if (existing[0]) {
    await db.delete(habitCompletions).where(eq(habitCompletions.id, existing[0].id));
    return false; // now unchecked
  } else {
    await db.insert(habitCompletions).values({ habitId, userId, date });
    return true; // now checked
  }
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function getGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goals).where(eq(goals.userId, userId));
}

export async function upsertGoal(userId: number, goal: typeof goals.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(goals).values({ ...goal, userId }).onDuplicateKeyUpdate({
    set: {
      title: goal.title,
      categoryId: goal.categoryId,
      progress: goal.progress ?? 0,
      current: goal.current ?? null,
      target: goal.target ?? null,
      dueDate: goal.dueDate ?? null,
      done: goal.done ?? false,
      sortOrder: goal.sortOrder ?? 0,
    },
  });
}

export async function deleteGoal(userId: number, goalId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
}

// ─── Roadmap Projects ─────────────────────────────────────────────────────────

export async function getRoadmapProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roadmapProjects).where(eq(roadmapProjects.userId, userId));
}

export async function upsertRoadmapProject(userId: number, project: typeof roadmapProjects.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(roadmapProjects).values({ ...project, userId }).onDuplicateKeyUpdate({
    set: {
      name: project.name,
      emoji: project.emoji,
      color: project.color,
      startMonth: project.startMonth,
      endMonth: project.endMonth,
      progress: project.progress ?? 0,
      milestones: project.milestones ?? null,
      goalType: project.goalType ?? "milestone",
      targetValue: project.targetValue ?? null,
      currentValue: project.currentValue ?? null,
      sortOrder: project.sortOrder ?? 0,
    },
  });
}

export async function deleteRoadmapProject(userId: number, projectId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(roadmapProjects).where(and(eq(roadmapProjects.id, projectId), eq(roadmapProjects.userId, userId)));
}

// ─── Mood Entries ─────────────────────────────────────────────────────────────

export async function getMoodEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(moodEntries).where(eq(moodEntries.userId, userId));
}

export async function upsertMoodEntry(userId: number, entry: typeof moodEntries.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  // Delete existing for that date then insert
  await db.delete(moodEntries).where(and(eq(moodEntries.userId, userId), eq(moodEntries.date, entry.date)));
  await db.insert(moodEntries).values({ ...entry, userId });
}

// ─── Evening Entries ──────────────────────────────────────────────────────────

export async function getEveningEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eveningEntries).where(eq(eveningEntries.userId, userId));
}

export async function upsertEveningEntry(userId: number, entry: typeof eveningEntries.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.delete(eveningEntries).where(and(eq(eveningEntries.userId, userId), eq(eveningEntries.date, entry.date)));
  await db.insert(eveningEntries).values({ ...entry, userId });
}

// ─── Bulk habit completions (for import) ─────────────────────────────────────

export async function bulkInsertHabitCompletions(
  userId: number,
  rows: { habitId: string; date: string }[]
) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  // Insert ignore duplicates
  for (const row of rows) {
    const existing = await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, row.habitId),
          eq(habitCompletions.userId, userId),
          eq(habitCompletions.date, row.date)
        )
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(habitCompletions).values({ habitId: row.habitId, userId, date: row.date });
    }
  }
}

// ─── Reflections ──────────────────────────────────────────────────────────────

export async function getReflections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reflections).where(eq(reflections.userId, userId));
}

export async function upsertReflection(userId: number, reflection: typeof reflections.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reflections).values({ ...reflection, userId }).onDuplicateKeyUpdate({
    set: { answers: reflection.answers ?? null },
  });
}
