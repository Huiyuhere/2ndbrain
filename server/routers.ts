import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  bulkInsertHabitCompletions,
  deleteGoal,
  deleteHabit,
  deleteRoadmapProject,
  deleteTask,
  getCategories,
  getEveningEntries,
  getGoals,
  getHabits,
  getMoodEntries,
  getOrCreateProfile,
  getRoadmapProjects,
  getReflections,
  getTasks,
  toggleHabitCompletion,
  updateProfile,
  upsertCategories,
  upsertEveningEntry,
  upsertGoal,
  upsertHabit,
  upsertMoodEntry,
  upsertReflection,
  upsertRoadmapProject,
  upsertTask,
} from "./db";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const SubtaskSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean() });
const LinkSchema = z.object({ label: z.string(), url: z.string() });
const HighlightSchema = z.object({ type: z.enum(["+", "-"]), text: z.string() });
const MilestoneSchema = z.object({ month: z.number(), label: z.string() });

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  categoryId: z.string().default("work"),
  column: z.enum(["ideas", "future", "week", "today", "done"]).default("ideas"),
  duration: z.string().optional(),
  scheduledTime: z.string().optional(),
  scheduledDate: z.string().optional(),
  subtasks: z.array(SubtaskSchema).optional(),
  links: z.array(LinkSchema).optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

const HabitSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  sortOrder: z.number().optional(),
});

const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  categoryId: z.string().default("work"),
  progress: z.number().default(0),
  current: z.string().optional(),
  target: z.string().optional(),
  dueDate: z.string().optional(),
  done: z.boolean().default(false),
  sortOrder: z.number().optional(),
});

const RoadmapProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  color: z.string(),
  startMonth: z.number(),
  endMonth: z.number(),
  progress: z.number().default(0),
  milestones: z.array(MilestoneSchema).optional(),
  goalType: z.enum(["numerical", "milestone"]).optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  sortOrder: z.number().optional(),
});

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  bgColor: z.string(),
  textColor: z.string(),
  keywords: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
});

const MoodEntrySchema = z.object({
  date: z.string(),
  mood: z.number(),
  sleep: z.number(),
  intention: z.string().optional(),
  focus: z.string().optional(),
});

const EveningEntrySchema = z.object({
  date: z.string(),
  location: z.string().optional(),
  title: z.string().optional(),
  rating: z.number().optional(),
  highlights: z.array(HighlightSchema).optional(),
  freeWrite: z.string().optional(),
  photoUrl: z.string().optional(),
});

const ReflectionSchema = z.object({
  id: z.string(),
  type: z.enum(["weekly", "monthly", "quarterly"]),
  date: z.string(),
  answers: z.record(z.string(), z.string()).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Profile ────────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getOrCreateProfile(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
        focusMode: z.enum(["life", "work", "personal"]).optional(),
        monthlyIntention: z.string().optional(),
        quarterlyGoalText: z.string().optional(),
        quarterlyGoalProgress: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Categories ─────────────────────────────────────────────────────────────
  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getCategories(ctx.user.id);
    }),
    setAll: protectedProcedure
      .input(z.array(CategorySchema))
      .mutation(async ({ ctx, input }) => {
        await upsertCategories(ctx.user.id, input.map(c => ({
          id: c.id,
          userId: ctx.user.id,
          name: c.name,
          emoji: c.emoji,
          bgColor: c.bgColor,
          textColor: c.textColor,
          keywords: c.keywords ?? [],
          sortOrder: c.sortOrder ?? 0,
        })));
        return { success: true };
      }),
  }),

  // ─── Tasks ──────────────────────────────────────────────────────────────────
  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTasks(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(TaskSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertTask(ctx.user.id, {
          id: input.id,
          userId: ctx.user.id,
          title: input.title,
          categoryId: input.categoryId,
          column: input.column,
          duration: input.duration ?? null,
          scheduledTime: input.scheduledTime ?? null,
          scheduledDate: input.scheduledDate ?? null,
          subtasks: input.subtasks ?? null,
          links: input.links ?? null,
          notes: input.notes ?? null,
          createdAt: input.createdAt,
          completedAt: input.completedAt ?? null,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTask(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  // ─── Habits ─────────────────────────────────────────────────────────────────
  habits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getHabits(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(HabitSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertHabit(ctx.user.id, {
          id: input.id,
          userId: ctx.user.id,
          name: input.name,
          emoji: input.emoji,
          sortOrder: input.sortOrder ?? 0,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteHabit(ctx.user.id, input.id);
        return { success: true };
      }),
    toggle: protectedProcedure
      .input(z.object({ habitId: z.string(), date: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const checked = await toggleHabitCompletion(ctx.user.id, input.habitId, input.date);
        return { checked };
      }),
  }),

  // ─── Goals ──────────────────────────────────────────────────────────────────
  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getGoals(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(GoalSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertGoal(ctx.user.id, {
          id: input.id,
          userId: ctx.user.id,
          title: input.title,
          categoryId: input.categoryId,
          progress: input.progress,
          current: input.current ?? null,
          target: input.target ?? null,
          dueDate: input.dueDate ?? null,
          done: input.done,
          sortOrder: input.sortOrder ?? 0,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteGoal(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  // ─── Roadmap ─────────────────────────────────────────────────────────────────
  roadmap: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getRoadmapProjects(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(RoadmapProjectSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertRoadmapProject(ctx.user.id, {
          id: input.id,
          userId: ctx.user.id,
          name: input.name,
          emoji: input.emoji,
          color: input.color,
          startMonth: input.startMonth,
          endMonth: input.endMonth,
          progress: input.progress,
          milestones: input.milestones ?? null,
          goalType: input.goalType ?? "milestone",
          targetValue: input.targetValue ?? null,
          currentValue: input.currentValue ?? null,
          sortOrder: input.sortOrder ?? 0,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteRoadmapProject(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  // ─── Mood / Morning check-in ─────────────────────────────────────────────────
  mood: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getMoodEntries(ctx.user.id);
    }),
    save: protectedProcedure
      .input(MoodEntrySchema)
      .mutation(async ({ ctx, input }) => {
        await upsertMoodEntry(ctx.user.id, {
          userId: ctx.user.id,
          date: input.date,
          mood: input.mood,
          sleep: input.sleep,
          intention: input.intention ?? null,
          focus: input.focus ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Evening Journal ─────────────────────────────────────────────────────────
  evening: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getEveningEntries(ctx.user.id);
    }),
    save: protectedProcedure
      .input(EveningEntrySchema)
      .mutation(async ({ ctx, input }) => {
        await upsertEveningEntry(ctx.user.id, {
          userId: ctx.user.id,
          date: input.date,
          location: input.location ?? null,
          title: input.title ?? null,
          rating: input.rating ?? 5,
          highlights: input.highlights ?? null,
          freeWrite: input.freeWrite ?? null,
          photoUrl: input.photoUrl ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Reflections ─────────────────────────────────────────────────────────────
  reflections: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getReflections(ctx.user.id);
    }),
    save: protectedProcedure
      .input(ReflectionSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertReflection(ctx.user.id, {
          id: input.id,
          userId: ctx.user.id,
          type: input.type,
          date: input.date,
          answers: (input.answers ?? null) as Record<string, string> | null,
        });
        return { success: true };
      }),
  }),

  // ─── Bulk sync (load everything at once) ─────────────────────────────────────
  sync: router({
    // One-shot import from legacy localStorage snapshot
    importLegacy: protectedProcedure
      .input(z.object({
        categories: z.array(CategorySchema).optional(),
        tasks: z.array(TaskSchema).optional(),
        habits: z.array(z.object({
          id: z.string(),
          name: z.string(),
          emoji: z.string(),
          completedDates: z.array(z.string()).optional(),
        })).optional(),
        goals: z.array(GoalSchema).optional(),
        roadmapProjects: z.array(RoadmapProjectSchema).optional(),
        moodEntries: z.array(MoodEntrySchema).optional(),
        eveningEntries: z.array(EveningEntrySchema).optional(),
        reflections: z.array(ReflectionSchema).optional(),
        profile: z.object({
          name: z.string().optional(),
          bio: z.string().optional(),
          focusMode: z.enum(['life', 'work', 'personal']).optional(),
          monthlyIntention: z.string().optional(),
          quarterlyGoalText: z.string().optional(),
          quarterlyGoalProgress: z.number().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        if (input.profile) await updateProfile(userId, input.profile);
        if (input.categories?.length) {
          await upsertCategories(userId, input.categories.map((c, i) => ({
            id: c.id, userId, name: c.name, emoji: c.emoji,
            bgColor: c.bgColor, textColor: c.textColor,
            keywords: c.keywords ?? [], sortOrder: c.sortOrder ?? i,
          })));
        }
        for (const t of input.tasks ?? []) {
          await upsertTask(userId, {
            id: t.id, userId, title: t.title, categoryId: t.categoryId,
            column: t.column, duration: t.duration ?? null,
            scheduledTime: t.scheduledTime ?? null, scheduledDate: t.scheduledDate ?? null,
            subtasks: t.subtasks ?? null, links: t.links ?? null,
            notes: t.notes ?? null, createdAt: t.createdAt,
            completedAt: t.completedAt ?? null,
          });
        }
        const completionRows: { habitId: string; date: string }[] = [];
        for (const h of input.habits ?? []) {
          await upsertHabit(userId, { id: h.id, userId, name: h.name, emoji: h.emoji, sortOrder: 0 });
          for (const date of h.completedDates ?? []) completionRows.push({ habitId: h.id, date });
        }
        await bulkInsertHabitCompletions(userId, completionRows);
        for (const g of input.goals ?? []) {
          await upsertGoal(userId, {
            id: g.id, userId, title: g.title, categoryId: g.categoryId,
            progress: g.progress ?? 0, current: g.current ?? null,
            target: g.target ?? null, dueDate: g.dueDate ?? null,
            done: g.done ?? false, sortOrder: g.sortOrder ?? 0,
          });
        }
        for (const p of input.roadmapProjects ?? []) {
          await upsertRoadmapProject(userId, {
            id: p.id, userId, name: p.name, emoji: p.emoji, color: p.color,
            startMonth: p.startMonth, endMonth: p.endMonth,
            progress: p.progress ?? 0, milestones: p.milestones ?? null,
            goalType: p.goalType ?? 'milestone',
            targetValue: p.targetValue ?? null, currentValue: p.currentValue ?? null,
            sortOrder: p.sortOrder ?? 0,
          });
        }
        for (const m of input.moodEntries ?? []) {
          await upsertMoodEntry(userId, {
            userId, date: m.date, mood: m.mood, sleep: m.sleep,
            intention: m.intention ?? null, focus: m.focus ?? null,
          });
        }
        for (const e of input.eveningEntries ?? []) {
          await upsertEveningEntry(userId, {
            userId, date: e.date, location: e.location ?? null,
            title: e.title ?? null, rating: e.rating ?? null,
            highlights: e.highlights ?? null, freeWrite: e.freeWrite ?? null,
            photoUrl: e.photoUrl ?? null,
          });
        }
        for (const r of input.reflections ?? []) {
          await upsertReflection(userId, {
            id: r.id, userId, type: r.type, date: r.date,
            answers: (r.answers ?? null) as Record<string, string> | null,
          });
        }
        return { success: true };
      }),

    loadAll: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const [profile, cats, taskList, habitData, goalList, roadmapList, moodList, eveningList, reflectionList] =
        await Promise.all([
          getOrCreateProfile(userId),
          getCategories(userId),
          getTasks(userId),
          getHabits(userId),
          getGoals(userId),
          getRoadmapProjects(userId),
          getMoodEntries(userId),
          getEveningEntries(userId),
          getReflections(userId),
        ]);
      return {
        profile,
        categories: cats,
        tasks: taskList,
        habits: habitData.habits,
        habitCompletions: habitData.completions,
        goals: goalList,
        roadmapProjects: roadmapList,
        moodEntries: moodList,
        eveningEntries: eveningList,
        reflections: reflectionList,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
