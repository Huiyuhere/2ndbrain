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
  reflectionInsights,
  reflections,
  roadmapProjects,
  tasks,
  timeBlocks,
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
      taskType: task.taskType ?? null,
      actualMinutes: task.actualMinutes ?? null,
      completedAt: task.completedAt ?? null,
      recurFreq: task.recurFreq ?? null,
      recurEndDate: task.recurEndDate ?? null,
    },
  });
}

export async function getTaskById(userId: number, taskId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  return rows[0] ?? null;
}
export async function updateTaskGoogleEventId(userId: number, taskId: string, googleEventId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ googleEventId }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}
export async function deleteTask(userId: number, taskId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

// ─── Time blocks ─────────────────────────────────────────────
export async function getTimeBlocks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
}

export async function upsertTimeBlock(userId: number, block: typeof timeBlocks.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(timeBlocks).values({ ...block, userId }).onDuplicateKeyUpdate({
    set: {
      title: block.title,
      date: block.date,
      startMin: block.startMin,
      endMin: block.endMin,
      categoryId: block.categoryId ?? null,
      taskType: block.taskType ?? null,
      recurFreq: block.recurFreq ?? null,
      recurEndDate: block.recurEndDate ?? null,
    },
  });
}

export async function getTimeBlockById(userId: number, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).limit(1);
  return rows[0] ?? null;
}
export async function updateTimeBlockGoogleEventId(userId: number, id: string, googleEventId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(timeBlocks).set({ googleEventId }).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)));
}
export async function deleteTimeBlock(userId: number, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)));
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

export async function deleteMoodEntry(userId: number, date: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(moodEntries).where(and(eq(moodEntries.userId, userId), eq(moodEntries.date, date)));
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

// ─── Projects ─────────────────────────────────────────────────────────────────

import {
  projects,
  projectTasks,
  projectMilestones,
  ProjectRow,
  ProjectTaskRow,
  ProjectMilestoneRow,
} from "../drizzle/schema";

export async function getReflectionInsight(
  userId: number,
  period: "weekly" | "monthly" | "quarterly",
  periodKey: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(reflectionInsights)
    .where(
      and(
        eq(reflectionInsights.userId, userId),
        eq(reflectionInsights.period, period),
        eq(reflectionInsights.periodKey, periodKey)
      )
    )
    .limit(1);
  return rows[0];
}

export async function upsertReflectionInsight(
  userId: number,
  period: "weekly" | "monthly" | "quarterly",
  periodKey: string,
  content: string
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(reflectionInsights)
    .where(
      and(
        eq(reflectionInsights.userId, userId),
        eq(reflectionInsights.period, period),
        eq(reflectionInsights.periodKey, periodKey)
      )
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(reflectionInsights)
      .set({ content, generatedAt: new Date() })
      .where(eq(reflectionInsights.id, existing[0].id));
  } else {
    await db.insert(reflectionInsights).values({ userId, period, periodKey, content });
  }
}

export async function getProjects(userId: number): Promise<ProjectRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function upsertProject(userId: number, project: typeof projects.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projects).values({ ...project, userId }).onDuplicateKeyUpdate({
    set: {
      title: project.title,
      emoji: project.emoji ?? null,
      color: project.color ?? null,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status ?? "active",
      description: project.description ?? null,
    },
  });
}

export async function deleteProject(userId: number, id: string) {
  const db = await getDb();
  if (!db) return;
  // cascade delete tasks and milestones
  await db.delete(projectMilestones).where(and(eq(projectMilestones.userId, userId), eq(projectMilestones.projectId, id)));
  await db.delete(projectTasks).where(and(eq(projectTasks.userId, userId), eq(projectTasks.projectId, id)));
  await db.delete(projects).where(and(eq(projects.userId, userId), eq(projects.id, id)));
}

// ─── Project Tasks ─────────────────────────────────────────────────────────────

export async function getProjectTasks(userId: number, projectId: string): Promise<ProjectTaskRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectTasks).where(
    and(eq(projectTasks.userId, userId), eq(projectTasks.projectId, projectId))
  );
}

export async function upsertProjectTask(userId: number, task: typeof projectTasks.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectTasks).values({ ...task, userId }).onDuplicateKeyUpdate({
    set: {
      title: task.title,
      startDate: task.startDate,
      dueDate: task.dueDate,
      status: task.status ?? "todo",
      boardTaskId: task.boardTaskId ?? null,
      dependsOn: task.dependsOn ?? null,
      color: task.color ?? null,
      notes: task.notes ?? null,
    },
  });
}

export async function deleteProjectTask(userId: number, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectTasks).where(and(eq(projectTasks.userId, userId), eq(projectTasks.id, id)));
}

// ─── Project Milestones ────────────────────────────────────────────────────────

export async function getProjectMilestones(userId: number, projectId: string): Promise<ProjectMilestoneRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectMilestones).where(
    and(eq(projectMilestones.userId, userId), eq(projectMilestones.projectId, projectId))
  );
}

export async function upsertProjectMilestone(userId: number, milestone: typeof projectMilestones.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectMilestones).values({ ...milestone, userId }).onDuplicateKeyUpdate({
    set: {
      title: milestone.title,
      date: milestone.date,
      reached: milestone.reached ?? false,
      taskId: milestone.taskId ?? null,
    },
  });
}

export async function deleteProjectMilestone(userId: number, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectMilestones).where(and(eq(projectMilestones.userId, userId), eq(projectMilestones.id, id)));
}
