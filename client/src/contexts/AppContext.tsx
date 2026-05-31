import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  AppState, Task, Habit, MoodEntry, EveningEntry, Goal, Reflection,
  Category, RoadmapProject, UserProfile,
  getTodayString, autoClassify, getStreak,
} from '@/lib/store';
import { nanoid } from 'nanoid';
import { getLoginUrl } from '@/const';

// ─── Default data (used when user has no DB data yet) ─────────────────────────

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work',     name: 'Work',     emoji: '💼', bgColor: '#E8F4FB', textColor: '#2471A3', keywords: ['type','build','launch','bot','code','integrate','portfolio','tech'] },
  { id: 'ideas',    name: 'Ideas',    emoji: '💡', bgColor: '#FEF5E0', textColor: '#C9952A', keywords: ['idea','biz','concept','filter','makeup'] },
  { id: 'personal', name: 'Personal', emoji: '🌸', bgColor: '#F0EDF8', textColor: '#6B5EA8', keywords: ['journal','self','read','meditate','gym','walk','personal'] },
  { id: 'research', name: 'Research', emoji: '🔍', bgColor: '#E8F8F2', textColor: '#2E8B57', keywords: ['research','find','explore','question','venue'] },
  { id: 'planning', name: 'Planning', emoji: '🗂️', bgColor: '#FEF0E8', textColor: '#C4704A', keywords: ['strategy','plan','branding','social','media','tiktok','niche'] },
  { id: 'exercise', name: 'Exercise', emoji: '🏃', bgColor: '#FDECEA', textColor: '#C0392B', keywords: ['gym','run','workout','walk','exercise','sport'] },
];

function buildDefaultState(): AppState {
  return {
    userProfile: { name: '', bio: '', avatarUrl: '' },
    focusMode: 'life',
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    habits: [],
    moodEntries: [],
    eveningEntries: [],
    goals: [],
    reflections: [],
    roadmapProjects: [],
    quarterlyGoal: { text: '', progress: 0, daysLeft: 0 },
    checkinDone: false,
    streak: 0,
    monthlyIntention: '',
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

type AppContextType = {
  state: AppState;
  loading: boolean;
  setFocusMode: (mode: AppState['focusMode']) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, column: Task['column']) => void;
  toggleHabit: (habitId: string, date: string) => void;
  saveMoodEntry: (entry: MoodEntry) => void;
  saveEveningEntry: (entry: EveningEntry) => void;
  saveReflection: (reflection: Omit<Reflection, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  markCheckinDone: () => void;
  updateCategories: (cats: Category[]) => void;
  updateQuarterlyGoal: (updates: Partial<AppState['quarterlyGoal']>) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'completedDates'>) => void;
  deleteHabit: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  deleteGoal: (id: string) => void;
  addProject: (project: Omit<RoadmapProject, 'id'>) => void;
  updateProject: (id: string, updates: Partial<RoadmapProject>) => void;
  deleteProject: (id: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateMonthlyIntention: (text: string) => void;
};

const AppContext = createContext<AppContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AppState>(buildDefaultState);
  const [dbLoading, setDbLoading] = useState(true);
  const seededRef = useRef(false);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const upsertTask = trpc.tasks.upsert.useMutation();
  const deleteTaskMut = trpc.tasks.delete.useMutation();
  const upsertHabit = trpc.habits.upsert.useMutation();
  const deleteHabitMut = trpc.habits.delete.useMutation();
  const toggleHabitMut = trpc.habits.toggle.useMutation();
  const upsertGoal = trpc.goals.upsert.useMutation();
  const deleteGoalMut = trpc.goals.delete.useMutation();
  const upsertProject = trpc.roadmap.upsert.useMutation();
  const deleteProjectMut = trpc.roadmap.delete.useMutation();
  const saveMood = trpc.mood.save.useMutation();
  const saveEvening = trpc.evening.save.useMutation();
  const saveRefl = trpc.reflections.save.useMutation();
  const setAllCategories = trpc.categories.setAll.useMutation();
  const updateProfileMut = trpc.profile.update.useMutation();

  // ── Load all data from DB once user is authenticated ──────────────────────
  const loadAll = trpc.sync.loadAll.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!user || loadAll.isLoading) return;
    if (loadAll.error) { setDbLoading(false); return; }
    if (!loadAll.data) return;
    if (seededRef.current) return;

    const d = loadAll.data;
    const today = getTodayString();

    // Merge DB data into AppState shape
    const categories: Category[] = d.categories.length > 0
      ? d.categories.map(c => ({
          id: c.id, name: c.name, emoji: c.emoji,
          bgColor: c.bgColor, textColor: c.textColor,
          keywords: (c.keywords as string[]) ?? [],
        }))
      : DEFAULT_CATEGORIES;

    const tasks: Task[] = d.tasks.map(t => ({
      id: t.id, title: t.title, categoryId: t.categoryId,
      column: t.column as Task['column'],
      duration: t.duration ?? undefined,
      scheduledTime: t.scheduledTime ?? undefined,
      scheduledDate: t.scheduledDate ?? undefined,
      subtasks: (t.subtasks as Task['subtasks']) ?? [],
      links: (t.links as Task['links']) ?? [],
      notes: t.notes ?? undefined,
      createdAt: t.createdAt,
      completedAt: t.completedAt ?? undefined,
    }));

    // Build habits with completedDates from habit_completions
    const habits: Habit[] = d.habits.map(h => ({
      id: h.id, name: h.name, emoji: h.emoji,
      completedDates: d.habitCompletions
        .filter(c => c.habitId === h.id)
        .map(c => c.date),
    }));

    const goals: Goal[] = d.goals.map(g => ({
      id: g.id, title: g.title, categoryId: g.categoryId,
      progress: g.progress ?? 0,
      current: g.current ?? undefined,
      target: g.target ?? undefined,
      dueDate: g.dueDate ?? undefined,
    }));

    const roadmapProjects: RoadmapProject[] = d.roadmapProjects.map(p => ({
      id: p.id, name: p.name, emoji: p.emoji, color: p.color,
      startMonth: p.startMonth, endMonth: p.endMonth,
      progress: p.progress ?? 0,
      milestones: (p.milestones as RoadmapProject['milestones']) ?? [],
      goalType: p.goalType ?? undefined,
      targetValue: p.targetValue ?? undefined,
      currentValue: p.currentValue ?? undefined,
    }));

    const moodEntries: MoodEntry[] = d.moodEntries.map(m => ({
      date: m.date, mood: m.mood, sleep: m.sleep,
      intention: m.intention ?? '',
      focus: m.focus ?? '',
    }));

    const eveningEntries: EveningEntry[] = d.eveningEntries.map(e => ({
      date: e.date,
      location: e.location ?? '',
      title: e.title ?? '',
      rating: e.rating ?? 5,
      highlights: (e.highlights as EveningEntry['highlights']) ?? [],
      freeWrite: e.freeWrite ?? '',
      photoUrl: e.photoUrl ?? undefined,
    }));

    const reflections: Reflection[] = d.reflections.map(r => ({
      id: r.id, type: r.type, date: r.date,
      answers: (r.answers as Record<string, string>) ?? {},
    }));

    const profile = d.profile;
    const checkinDone = moodEntries.some(m => m.date === today);

    setState({
      userProfile: {
        name: profile?.name ?? user.name ?? '',
        bio: profile?.bio ?? '',
        avatarUrl: profile?.avatarUrl ?? '',
      },
      focusMode: (profile?.focusMode as AppState['focusMode']) ?? 'life',
      categories,
      tasks,
      habits,
      moodEntries,
      eveningEntries,
      goals,
      reflections,
      roadmapProjects,
      quarterlyGoal: {
        text: profile?.quarterlyGoalText ?? '',
        progress: profile?.quarterlyGoalProgress ?? 0,
        daysLeft: 0,
      },
      checkinDone,
      streak: getStreak(habits),
      monthlyIntention: profile?.monthlyIntention ?? '',
    });

    // Seed default categories if user has none
    if (d.categories.length === 0) {
      setAllCategories.mutate(DEFAULT_CATEGORIES);
    }

    seededRef.current = true;
    setDbLoading(false);
  }, [user, loadAll.data, loadAll.isLoading, loadAll.error]);

  // When not logged in, stop loading
  useEffect(() => {
    if (!authLoading && !user) setDbLoading(false);
  }, [authLoading, user]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const setFocusMode = useCallback((mode: AppState['focusMode']) => {
    setState(s => ({ ...s, focusMode: mode }));
    if (user) updateProfileMut.mutate({ focusMode: mode });
  }, [user]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>): Task => {
    const newTask: Task = {
      ...task,
      id: nanoid(),
      createdAt: getTodayString(),
      categoryId: task.categoryId || autoClassify(task.title, state.categories),
    };
    setState(s => ({ ...s, tasks: [...s.tasks, newTask] }));
    if (user) upsertTask.mutate(newTask);
    return newTask;
  }, [state.categories, user]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState(s => {
      const updated = s.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
      const task = updated.find(t => t.id === id);
      if (user && task) upsertTask.mutate(task);
      return { ...s, tasks: updated };
    });
  }, [user]);

  const deleteTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
    if (user) deleteTaskMut.mutate({ id });
  }, [user]);

  const moveTask = useCallback((id: string, column: Task['column']) => {
    setState(s => {
      const updated = s.tasks.map(t => t.id === id
        ? { ...t, column, completedAt: column === 'done' ? getTodayString() : t.completedAt }
        : t);
      const task = updated.find(t => t.id === id);
      if (user && task) upsertTask.mutate(task);
      return { ...s, tasks: updated };
    });
  }, [user]);

  const toggleHabit = useCallback((habitId: string, date: string) => {
    setState(s => ({
      ...s,
      habits: s.habits.map(h => {
        if (h.id !== habitId) return h;
        const has = h.completedDates.includes(date);
        return {
          ...h,
          completedDates: has
            ? h.completedDates.filter(d => d !== date)
            : [...h.completedDates, date],
        };
      }),
    }));
    if (user) toggleHabitMut.mutate({ habitId, date });
  }, [user]);

  const saveMoodEntry = useCallback((entry: MoodEntry) => {
    setState(s => ({
      ...s,
      moodEntries: [...s.moodEntries.filter(e => e.date !== entry.date), entry],
      checkinDone: entry.date === getTodayString() ? true : s.checkinDone,
    }));
    if (user) saveMood.mutate(entry);
  }, [user]);

  const saveEveningEntry = useCallback((entry: EveningEntry) => {
    setState(s => ({
      ...s,
      eveningEntries: [...s.eveningEntries.filter(e => e.date !== entry.date), entry],
    }));
    if (user) saveEvening.mutate(entry);
  }, [user]);

  const saveReflection = useCallback((reflection: Omit<Reflection, 'id'>) => {
    const full: Reflection = { ...reflection, id: nanoid() };
    setState(s => ({
      ...s,
      reflections: [...s.reflections.filter(r => !(r.type === reflection.type && r.date === reflection.date)), full],
    }));
    if (user) saveRefl.mutate(full);
  }, [user]);

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setState(s => {
      const updated = s.goals.map(g => g.id === id ? { ...g, ...updates } : g);
      const goal = updated.find(g => g.id === id);
      if (user && goal) upsertGoal.mutate(goal);
      return { ...s, goals: updated };
    });
  }, [user]);

  const markCheckinDone = useCallback(() => {
    setState(s => ({ ...s, checkinDone: true }));
  }, []);

  const updateCategories = useCallback((cats: Category[]) => {
    setState(s => ({ ...s, categories: cats }));
    if (user) setAllCategories.mutate(cats);
  }, [user]);

  const updateQuarterlyGoal = useCallback((updates: Partial<AppState['quarterlyGoal']>) => {
    setState(s => {
      const updated = { ...s.quarterlyGoal, ...updates };
      if (user) updateProfileMut.mutate({
        quarterlyGoalText: updated.text,
        quarterlyGoalProgress: updated.progress,
      });
      return { ...s, quarterlyGoal: updated };
    });
  }, [user]);

  const addHabit = useCallback((habit: Omit<Habit, 'id' | 'completedDates'>) => {
    const newHabit: Habit = { ...habit, id: nanoid(), completedDates: [] };
    setState(s => ({ ...s, habits: [...s.habits, newHabit] }));
    if (user) upsertHabit.mutate({ id: newHabit.id, name: newHabit.name, emoji: newHabit.emoji });
  }, [user]);

  const deleteHabit = useCallback((id: string) => {
    setState(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) }));
    if (user) deleteHabitMut.mutate({ id });
  }, [user]);

  const addGoal = useCallback((goal: Omit<Goal, 'id'>) => {
    const newGoal: Goal = { ...goal, id: nanoid() };
    setState(s => ({ ...s, goals: [...s.goals, newGoal] }));
    if (user) upsertGoal.mutate(newGoal);
  }, [user]);

  const deleteGoal = useCallback((id: string) => {
    setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }));
    if (user) deleteGoalMut.mutate({ id });
  }, [user]);

  const addProject = useCallback((project: Omit<RoadmapProject, 'id'>) => {
    const newProject: RoadmapProject = { ...project, id: nanoid() };
    setState(s => ({ ...s, roadmapProjects: [...(s.roadmapProjects || []), newProject] }));
    if (user) upsertProject.mutate(newProject);
  }, [user]);

  const updateProject = useCallback((id: string, updates: Partial<RoadmapProject>) => {
    setState(s => {
      const updated = (s.roadmapProjects || []).map(p => p.id === id ? { ...p, ...updates } : p);
      const project = updated.find(p => p.id === id);
      if (user && project) upsertProject.mutate(project);
      return { ...s, roadmapProjects: updated };
    });
  }, [user]);

  const deleteProject = useCallback((id: string) => {
    setState(s => ({ ...s, roadmapProjects: (s.roadmapProjects || []).filter(p => p.id !== id) }));
    if (user) deleteProjectMut.mutate({ id });
  }, [user]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState(s => ({ ...s, userProfile: { ...s.userProfile, ...updates } }));
    if (user) updateProfileMut.mutate({
      name: updates.name,
      bio: updates.bio,
      avatarUrl: updates.avatarUrl,
    });
  }, [user]);

  const updateMonthlyIntention = useCallback((text: string) => {
    setState(s => ({ ...s, monthlyIntention: text }));
    if (user) updateProfileMut.mutate({ monthlyIntention: text });
  }, [user]);

  const loading = authLoading || (!!user && dbLoading);

  return (
    <AppContext.Provider value={{
      state, loading, setFocusMode, addTask, updateTask, deleteTask, moveTask,
      toggleHabit, saveMoodEntry, saveEveningEntry, saveReflection, updateGoal, markCheckinDone,
      updateCategories, updateQuarterlyGoal,
      addHabit, deleteHabit, addGoal, deleteGoal, addProject, updateProject, deleteProject,
      updateProfile, updateMonthlyIntention,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
