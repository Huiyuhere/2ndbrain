import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState, Task, Habit, MoodEntry, EveningEntry, Goal, Reflection, Category, loadState, saveState, getTodayString, autoClassify } from '@/lib/store';
import { nanoid } from 'nanoid';

type AppContextType = {
  state: AppState;
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
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setFocusMode = useCallback((mode: AppState['focusMode']) => {
    setState(s => ({ ...s, focusMode: mode }));
  }, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>): Task => {
    const newTask: Task = {
      ...task,
      id: nanoid(),
      createdAt: getTodayString(),
      categoryId: task.categoryId || autoClassify(task.title, state.categories),
    };
    setState(s => ({ ...s, tasks: [...s.tasks, newTask] }));
    return newTask;
  }, [state.categories]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
  }, []);

  const moveTask = useCallback((id: string, column: Task['column']) => {
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id
        ? { ...t, column, completedAt: column === 'done' ? getTodayString() : t.completedAt }
        : t),
    }));
  }, []);

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
  }, []);

  const saveMoodEntry = useCallback((entry: MoodEntry) => {
    setState(s => ({
      ...s,
      moodEntries: [...s.moodEntries.filter(e => e.date !== entry.date), entry],
    }));
  }, []);

  const saveEveningEntry = useCallback((entry: EveningEntry) => {
    setState(s => ({
      ...s,
      eveningEntries: [...s.eveningEntries.filter(e => e.date !== entry.date), entry],
    }));
  }, []);

  const saveReflection = useCallback((reflection: Omit<Reflection, 'id'>) => {
    setState(s => ({
      ...s,
      reflections: [...s.reflections.filter(r => !(r.type === reflection.type && r.date === reflection.date)), { ...reflection, id: nanoid() }],
    }));
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setState(s => ({
      ...s,
      goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g),
    }));
  }, []);

  const markCheckinDone = useCallback(() => {
    setState(s => ({ ...s, checkinDone: true }));
  }, []);

  const updateCategories = useCallback((cats: Category[]) => {
    setState(s => ({ ...s, categories: cats }));
  }, []);

  const updateQuarterlyGoal = useCallback((updates: Partial<AppState['quarterlyGoal']>) => {
    setState(s => ({ ...s, quarterlyGoal: { ...s.quarterlyGoal, ...updates } }));
  }, []);

  return (
    <AppContext.Provider value={{
      state, setFocusMode, addTask, updateTask, deleteTask, moveTask,
        toggleHabit, saveMoodEntry, saveEveningEntry, saveReflection, updateGoal, markCheckinDone,
        updateCategories, updateQuarterlyGoal,
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
