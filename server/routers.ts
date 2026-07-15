import { z } from "zod";
import { storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, workspaceProcedure } from "./_core/trpc";
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
  getProjects,
  upsertProject,
  deleteProject,
  getProjectTasks,
  upsertProjectTask,
  deleteProjectTask,
  getProjectMilestones,
  upsertProjectMilestone,
  deleteProjectMilestone,
  getTimeBlocks,
  upsertTimeBlock,
  deleteTimeBlock,
} from "./db";

import {
  getOrGenerateInsight,
  generateInsight,
  getLastCompletedPeriodKey,
  getPeriodLabel,
  type Period,
} from "./insights";
import { answerQuestion } from "./askManus";
import { googleCalendarRouter } from "./routers/googleCalendar";
import {
  pushEventToGoogle,
  deleteEventFromGoogle,
  getGoogleConnectionStatus,
} from "./googleCalendar";
import {
  getTaskById,
  updateTaskGoogleEventId,
  getTimeBlockById,
  updateTimeBlockGoogleEventId,
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
  taskType: z.string().optional(),
  actualMinutes: z.number().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  recurFreq: z.enum(["daily", "weekly"]).optional().nullable(),
  recurEndDate: z.string().optional().nullable(),
});

const TimeBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  startMin: z.number(),
  endMin: z.number(),
  categoryId: z.string().optional().nullable(),
  taskType: z.string().optional().nullable(),
  recurFreq: z.enum(["daily", "weekly"]).optional().nullable(),
  recurEndDate: z.string().optional().nullable(),
  createdAt: z.string(),
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
  moodScore: z.number().min(1).max(5).optional(),
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
    get: workspaceProcedure.query(async ({ ctx }) => {
      return getOrCreateProfile(ctx.workspaceOwnerId!);
    }),
    update: workspaceProcedure
      .input(z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
        focusMode: z.enum(["life", "work", "type", "personal"]).optional(),
        monthlyIntention: z.string().optional(),
        quarterlyGoalText: z.string().optional(),
        quarterlyGoalProgress: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateProfile(ctx.workspaceOwnerId!, input);
        return { success: true };
      }),
    uploadAvatar: workspaceProcedure
      .input(z.object({
        base64: z.string(), // data:image/...;base64,...
        mimeType: z.string().default("image/jpeg"),
        filename: z.string().default("avatar.jpg"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Strip the data URL prefix
        const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const ext = input.mimeType.split("/")[1] ?? "jpg";
        const key = `avatars/user-${ctx.workspaceOwnerId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateProfile(ctx.workspaceOwnerId!, { avatarUrl: url, avatarKey: key });
        return { url, key };
      }),
  }),

  // ─── Categories ─────────────────────────────────────────────────────────────
  categories: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getCategories(ctx.workspaceOwnerId!);
    }),
    setAll: workspaceProcedure
      .input(z.array(CategorySchema))
      .mutation(async ({ ctx, input }) => {
        await upsertCategories(ctx.workspaceOwnerId!, input.map(c => ({
          id: c.id,
          userId: ctx.workspaceOwnerId!,
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
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getTasks(ctx.workspaceOwnerId!);
    }),
    upsert: workspaceProcedure
      .input(TaskSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        // Fetch existing task to preserve googleEventId
        const existing = await getTaskById(userId, input.id);
        await upsertTask(userId, {
          id: input.id,
          userId,
          title: input.title,
          categoryId: input.categoryId,
          column: input.column,
          duration: input.duration ?? null,
          scheduledTime: input.scheduledTime ?? null,
          scheduledDate: input.scheduledDate ?? null,
          subtasks: input.subtasks ?? null,
          links: input.links ?? null,
          notes: input.notes ?? null,
          taskType: input.taskType ?? null,
          actualMinutes: input.actualMinutes ?? null,
          createdAt: input.createdAt,
          completedAt: input.completedAt ?? null,
          recurFreq: input.recurFreq ?? null,
          recurEndDate: input.recurEndDate ?? null,
          googleEventId: existing?.googleEventId ?? null,
        });
        // Push to Google Calendar if task has a scheduled date (and is not recurring)
        if (input.scheduledDate && !input.recurFreq) {
          const { connected } = await getGoogleConnectionStatus(userId);
          if (connected) {
            // Parse scheduledTime like "09:30" into minutes
            let startMin: number | null = null;
            let endMin: number | null = null;
            if (input.scheduledTime) {
              const [h, m] = input.scheduledTime.split(":").map(Number);
              startMin = h * 60 + m;
              // Estimate end from duration string like "1h 30m" or "30m"
              if (input.duration) {
                const hMatch = input.duration.match(/(\d+)h/);
                const mMatch = input.duration.match(/(\d+)m/);
                const durationMin = (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
                endMin = startMin + (durationMin || 60);
              } else {
                endMin = startMin + 60;
              }
            }
            pushEventToGoogle(
              userId,
              { title: input.title, date: input.scheduledDate, startMin, endMin, description: input.notes ?? undefined },
              existing?.googleEventId ?? null
            ).then((gId) => {
              if (gId) updateTaskGoogleEventId(userId, input.id, gId);
            }).catch(() => {});
          }
        }
        return { success: true };
      }),
    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        const existing = await getTaskById(userId, input.id);
        await deleteTask(userId, input.id);
        // Fire-and-forget delete from Google Calendar
        if (existing?.googleEventId) {
          deleteEventFromGoogle(userId, existing.googleEventId).catch(() => {});
        }
        return { success: true };
      }),
  }),

  // ─── Time blocks ────────────────────────────────────────────
  timeBlocks: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getTimeBlocks(ctx.workspaceOwnerId!);
    }),
    upsert: workspaceProcedure
      .input(TimeBlockSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        // Fetch existing block to get its current googleEventId
        const existing = await getTimeBlockById(userId, input.id);
        await upsertTimeBlock(userId, {
          id: input.id,
          userId,
          title: input.title,
          date: input.date,
          startMin: input.startMin,
          endMin: input.endMin,
          categoryId: input.categoryId ?? null,
          taskType: input.taskType ?? null,
          recurFreq: input.recurFreq ?? null,
          recurEndDate: input.recurEndDate ?? null,
          createdAt: input.createdAt,
          googleEventId: existing?.googleEventId ?? null,
        });
        // Fire-and-forget push to Google Calendar (only for non-recurring blocks)
        if (!input.recurFreq) {
          const { connected } = await getGoogleConnectionStatus(userId);
          if (connected) {
            pushEventToGoogle(
              userId,
              { title: input.title, date: input.date, startMin: input.startMin, endMin: input.endMin },
              existing?.googleEventId ?? null
            ).then((gId) => {
              if (gId) updateTimeBlockGoogleEventId(userId, input.id, gId);
            }).catch(() => {});
          }
        }
        return { success: true };
      }),
    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        const existing = await getTimeBlockById(userId, input.id);
        await deleteTimeBlock(userId, input.id);
        // Fire-and-forget delete from Google Calendar
        if (existing?.googleEventId) {
          deleteEventFromGoogle(userId, existing.googleEventId).catch(() => {});
        }
        return { success: true };
      }),
  }),

  // ─── Habits ─────────────────────────────────────────────────────────────────
  habits: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getHabits(ctx.workspaceOwnerId!);
    }),
    upsert: workspaceProcedure
      .input(HabitSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertHabit(ctx.workspaceOwnerId!, {
          id: input.id,
          userId: ctx.workspaceOwnerId!,
          name: input.name,
          emoji: input.emoji,
          sortOrder: input.sortOrder ?? 0,
        });
        return { success: true };
      }),
    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteHabit(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),
    toggle: workspaceProcedure
      .input(z.object({ habitId: z.string(), date: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const checked = await toggleHabitCompletion(ctx.workspaceOwnerId!, input.habitId, input.date);
        return { checked };
      }),
  }),

  // ─── Goals ──────────────────────────────────────────────────────────────────
  goals: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getGoals(ctx.workspaceOwnerId!);
    }),
    upsert: workspaceProcedure
      .input(GoalSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertGoal(ctx.workspaceOwnerId!, {
          id: input.id,
          userId: ctx.workspaceOwnerId!,
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
    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteGoal(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),
  }),

  // ─── Roadmap ─────────────────────────────────────────────────────────────────
  roadmap: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getRoadmapProjects(ctx.workspaceOwnerId!);
    }),
    upsert: workspaceProcedure
      .input(RoadmapProjectSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertRoadmapProject(ctx.workspaceOwnerId!, {
          id: input.id,
          userId: ctx.workspaceOwnerId!,
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
    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteRoadmapProject(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),
  }),

  // ─── Mood / Morning check-in ─────────────────────────────────────────────────
  mood: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getMoodEntries(ctx.workspaceOwnerId!);
    }),
    save: workspaceProcedure
      .input(MoodEntrySchema)
      .mutation(async ({ ctx, input }) => {
        await upsertMoodEntry(ctx.workspaceOwnerId!, {
          userId: ctx.workspaceOwnerId!,
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
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getEveningEntries(ctx.workspaceOwnerId!);
    }),
    save: workspaceProcedure
      .input(EveningEntrySchema)
      .mutation(async ({ ctx, input }) => {
        await upsertEveningEntry(ctx.workspaceOwnerId!, {
          userId: ctx.workspaceOwnerId!,
          date: input.date,
          location: input.location ?? null,
          title: input.title ?? null,
          rating: input.rating ?? 5,
          moodScore: input.moodScore ?? 3,
          highlights: input.highlights ?? null,
          freeWrite: input.freeWrite ?? null,
          photoUrl: input.photoUrl ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Reflections ─────────────────────────────────────────────────────────────
  reflections: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getReflections(ctx.workspaceOwnerId!);
    }),
    save: workspaceProcedure
      .input(ReflectionSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertReflection(ctx.workspaceOwnerId!, {
          id: input.id,
          userId: ctx.workspaceOwnerId!,
          type: input.type,
          date: input.date,
          answers: (input.answers ?? null) as Record<string, string> | null,
        });
        return { success: true };
      }),
  }),

  // ─── Reflection Insights (AI CEO-mentor review) ──────────────────────────────
  insights: router({
    // Returns the cached insight for a period (or null if none generated yet).
    get: workspaceProcedure
      .input(
        z.object({
          period: z.enum(["weekly", "monthly", "quarterly"]),
          periodKey: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const period = input.period as Period;
        const periodKey = input.periodKey || getLastCompletedPeriodKey(period);
        const { getReflectionInsight } = await import("./db");
        const row = await getReflectionInsight(ctx.workspaceOwnerId!, period, periodKey);
        return {
          periodKey,
          label: getPeriodLabel(period, periodKey),
          content: row?.content ?? null,
          generatedAt: row?.generatedAt ?? null,
        };
      }),
    // Generates (caching) the insight; pass refresh:true to force regenerate.
    generate: workspaceProcedure
      .input(
        z.object({
          period: z.enum(["weekly", "monthly", "quarterly"]),
          periodKey: z.string().optional(),
          refresh: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const period = input.period as Period;
        const periodKey = input.periodKey || getLastCompletedPeriodKey(period);
        const label = getPeriodLabel(period, periodKey);
        if (input.refresh) {
          const { content } = await generateInsight(ctx.workspaceOwnerId!, period, periodKey);
          return { periodKey, label, content, cached: false, generatedAt: new Date() };
        }
        const result = await getOrGenerateInsight(ctx.workspaceOwnerId!, period, periodKey);
        return { periodKey, label, ...result };
      }),
  }),

  // ─── Ask Manus (grounded analytics chat) ──────────────────────────────────
  askManus: router({
    // Answer a free-form question grounded ONLY in the user's data snapshot.
    // `history` is the full conversation so far (ephemeral; the client holds it).
    ask: workspaceProcedure
      .input(
        z.object({
          history: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(4000),
              })
            )
            .min(1)
            .max(40),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const answer = await answerQuestion(ctx.workspaceOwnerId!, input.history);
        return { answer };
      }),
  }),

  // ─── Bulk sync (load everything at once) ─────────────────────────────────────
  sync: router({
    // One-shot import from legacy localStorage snapshot
    importLegacy: workspaceProcedure
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
          focusMode: z.enum(['life', 'work', 'type', 'personal']).optional(),
          monthlyIntention: z.string().optional(),
          quarterlyGoalText: z.string().optional(),
          quarterlyGoalProgress: z.number().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
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
            notes: t.notes ?? null, taskType: t.taskType ?? null,
            actualMinutes: t.actualMinutes ?? null, createdAt: t.createdAt,
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

    loadAll: workspaceProcedure.query(async ({ ctx }) => {
      const userId = ctx.workspaceOwnerId!;
      const [profile, cats, taskList, habitData, goalList, roadmapList, moodList, eveningList, reflectionList, tbList] =
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
          getTimeBlocks(userId),
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
        timeBlocks: tbList,
      };
    }),
  }),

  // ─── Projects ────────────────────────────────────────────────────────────────
  projects: router({
    list: workspaceProcedure.query(async ({ ctx }) => {
      return getProjects(ctx.workspaceOwnerId!);
    }),

    upsert: workspaceProcedure
      .input(z.object({
        id: z.string(),
        title: z.string(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(['active', 'completed', 'archived']).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        // Enforce max 3 active projects
        if (!input.status || input.status === 'active') {
          const existing = await getProjects(userId);
          const activeCount = existing.filter(p => p.status === 'active' && p.id !== input.id).length;
          if (activeCount >= 3) {
            throw new Error('MAX_PROJECTS: You can only have 3 active projects at a time. Complete one to add another.');
          }
        }
        // Enforce 2-month max duration
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
        if (end < start) throw new Error('End date must be after start date.');
        if (diffDays > 62) throw new Error('Projects cannot be longer than 2 months (62 days).');
        await upsertProject(userId, {
          id: input.id,
          userId,
          title: input.title,
          emoji: input.emoji ?? '📁',
          color: input.color ?? '#2E86C1',
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status ?? 'active',
          description: input.description ?? null,
        });
        return { success: true };
      }),

    delete: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProject(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),

    // ── Project Tasks ──────────────────────────────────────────────────────────
    listTasks: workspaceProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return getProjectTasks(ctx.workspaceOwnerId!, input.projectId);
      }),

    upsertTask: workspaceProcedure
      .input(z.object({
        id: z.string(),
        projectId: z.string(),
        title: z.string(),
        startDate: z.string(),
        dueDate: z.string(),
        status: z.enum(['todo', 'in_progress', 'done']).optional(),
        boardTaskId: z.string().optional(),
        dependsOn: z.array(z.string()).optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.workspaceOwnerId!;
        await upsertProjectTask(userId, {
          id: input.id,
          projectId: input.projectId,
          userId,
          title: input.title,
          startDate: input.startDate,
          dueDate: input.dueDate,
          status: input.status ?? 'todo',
          boardTaskId: input.boardTaskId ?? null,
          dependsOn: input.dependsOn ?? null,
          color: input.color ?? null,
          notes: input.notes ?? null,
        });
        return { success: true };
      }),

    deleteTask: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProjectTask(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),

    // ── Project Milestones ─────────────────────────────────────────────────────
    listMilestones: workspaceProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return getProjectMilestones(ctx.workspaceOwnerId!, input.projectId);
      }),

    upsertMilestone: workspaceProcedure
      .input(z.object({
        id: z.string(),
        projectId: z.string(),
        title: z.string(),
        date: z.string(),
        reached: z.boolean().optional(),
        taskId: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertProjectMilestone(ctx.workspaceOwnerId!, {
          id: input.id,
          projectId: input.projectId,
          userId: ctx.workspaceOwnerId!,
          title: input.title,
          date: input.date,
          reached: input.reached ?? false,
          taskId: input.taskId ?? null,
        });
        return { success: true };
      }),

    deleteMilestone: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProjectMilestone(ctx.workspaceOwnerId!, input.id);
        return { success: true };
      }),

    // Single combined query — avoids hooks-in-loop on the client
    listAll: workspaceProcedure.query(async ({ ctx }) => {
      const userId = ctx.workspaceOwnerId!;
      const projects = await getProjects(userId);
      const [allTasks, allMilestones] = await Promise.all([
        Promise.all(projects.map(p => getProjectTasks(userId, p.id))),
        Promise.all(projects.map(p => getProjectMilestones(userId, p.id))),
      ]);
      return {
        projects,
        tasks: allTasks.flat(),
        milestones: allMilestones.flat(),
      };
    }),
  }),

  // ─── Google Calendar ─────────────────────────────────────────────────────────
  googleCalendar: googleCalendarRouter,
});

export type AppRouter = typeof appRouter;

