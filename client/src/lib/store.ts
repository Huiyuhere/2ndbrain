// 2nd Brain — Central Data Store
// All state is stored in localStorage and managed via this module.

export type Category = {
  id: string;
  name: string;
  emoji: string;
  bgColor: string;
  textColor: string;
  keywords: string[];
};

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  column: 'ideas' | 'future' | 'week' | 'today' | 'done';
  duration?: string; // e.g. "1.5h"
  scheduledTime?: string; // e.g. "09:00"
  scheduledDate?: string; // ISO date
  subtasks?: { id: string; title: string; done: boolean }[];
  links?: { label: string; url: string }[];
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  completedDates: string[]; // ISO date strings
};

export type MoodEntry = {
  date: string;
  mood: number; // 1-5
  sleep: number; // hours
  intention: string;
  focus: string;
};

export type EveningEntry = {
  date: string;
  location: string;
  title: string;
  rating: number; // 1-10
  highlights: { type: '+' | '-'; text: string }[];
  freeWrite: string;
  photoUrl?: string;
};

export type Goal = {
  id: string;
  title: string;
  categoryId: string;
  progress: number; // 0-100
  target?: string;
  current?: string;
  dueDate?: string;
};

export type Reflection = {
  id: string;
  type: 'weekly' | 'monthly' | 'quarterly';
  date: string;
  answers: Record<string, string>;
};

export type UserProfile = {
  name: string;
  bio: string;
  avatarUrl: string;
};

export type RoadmapProject = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  startMonth: number; // 0-indexed from Jan 2026
  endMonth: number;
  progress: number; // 0-100
  milestones: { month: number; label: string }[];
};

export type AppState = {
  userProfile: UserProfile;
  focusMode: 'life' | 'work' | 'personal';
  categories: Category[];
  tasks: Task[];
  habits: Habit[];
  moodEntries: MoodEntry[];
  eveningEntries: EveningEntry[];
  goals: Goal[];
  reflections: Reflection[];
  roadmapProjects: RoadmapProject[];
  quarterlyGoal: { text: string; progress: number; daysLeft: number };
  checkinDone: boolean; // for today
  streak: number;
  monthlyIntention: string;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work',     name: 'Work',     emoji: '💼', bgColor: '#E8F4FB', textColor: '#2471A3', keywords: ['type','build','launch','bot','code','integrate','portfolio','tech'] },
  { id: 'ideas',    name: 'Ideas',    emoji: '💡', bgColor: '#FEF5E0', textColor: '#C9952A', keywords: ['idea','biz','concept','filter','makeup'] },
  { id: 'personal', name: 'Personal', emoji: '🌸', bgColor: '#F0EDF8', textColor: '#6B5EA8', keywords: ['journal','self','read','meditate','gym','walk','personal'] },
  { id: 'research', name: 'Research', emoji: '🔍', bgColor: '#E8F8F2', textColor: '#2E8B57', keywords: ['research','find','explore','question','venue'] },
  { id: 'planning', name: 'Planning', emoji: '🗂️', bgColor: '#FEF0E8', textColor: '#C4704A', keywords: ['strategy','plan','branding','social','media','tiktok','niche'] },
  { id: 'exercise', name: 'Exercise', emoji: '🏃', bgColor: '#FDECEA', textColor: '#C0392B', keywords: ['gym','run','workout','walk','exercise','sport'] },
];

const DEFAULT_TASKS: Task[] = [
  { id: 't1', title: 'Makeup filter biz', categoryId: 'ideas', column: 'ideas', createdAt: '2026-05-28' },
  { id: 't2', title: 'Accountability tool for ADHD brains', categoryId: 'ideas', column: 'ideas', createdAt: '2026-05-28' },
  { id: 't3', title: 'Home deco store concept', categoryId: 'ideas', column: 'ideas', createdAt: '2026-05-20' },
  { id: 't4', title: 'Filter biz BMC', categoryId: 'ideas', column: 'ideas', createdAt: '2026-05-20' },
  { id: 't5', title: '[1.5h] How I spent 2 days in 24h edit', categoryId: 'planning', column: 'future', createdAt: '2026-05-25' },
  { id: 't6', title: 'TikTok niche: leveraging AI for productivity', categoryId: 'planning', column: 'future', createdAt: '2026-05-24' },
  { id: 't7', title: 'Portfolio coded (React & templates)', categoryId: 'work', column: 'future', createdAt: '2026-04-01', notes: 'Overdue' },
  { id: 't8', title: 'Type — rotate co-host', categoryId: 'work', column: 'future', createdAt: '2026-05-20' },
  { id: 't9', title: 'Strategies: social media, accountability & branding', categoryId: 'planning', column: 'future', createdAt: '2026-05-22' },
  { id: 't10', title: 'Type W2 deck', categoryId: 'work', column: 'week', duration: '2h', createdAt: '2026-05-27', links: [{ label: 'Notion doc', url: 'https://notion.so' }, { label: 'Figma', url: 'https://figma.com' }] },
  { id: 't11', title: 'Find tech co-founder for Type 1-1 matching', categoryId: 'research', column: 'week', createdAt: '2026-05-27' },
  { id: 't12', title: '[Type] quiz for personality types', categoryId: 'work', column: 'week', createdAt: '2026-05-27', links: [{ label: 'Type quiz doc', url: 'https://notion.so' }] },
  { id: 't13', title: 'Accountability tool (for my ADHD brains)', categoryId: 'work', column: 'today', duration: '1.5h', scheduledTime: '08:00', scheduledDate: '2026-05-31', createdAt: '2026-05-31', links: [{ label: 'Figma mockup', url: 'https://figma.com' }] },
  { id: 't14', title: 'Makeup filter concept', categoryId: 'ideas', column: 'today', duration: '45m', scheduledTime: '10:00', scheduledDate: '2026-05-31', createdAt: '2026-05-31' },
  { id: 't15', title: 'Integrate Type sign-up with Telegram bot', categoryId: 'work', column: 'today', duration: '2h', createdAt: '2026-05-31', links: [{ label: 'Telegram docs', url: 'https://core.telegram.org/bots' }, { label: 'Type backend', url: 'https://github.com' }] },
  { id: 't16', title: 'First Chapter Reels content', categoryId: 'planning', column: 'done', createdAt: '2026-05-28', completedAt: '2026-05-28', subtasks: [{ id: 's1', title: 'Would you rather', done: true }, { id: 's2', title: 'The algo knows that u r single', done: true }, { id: 's3', title: 'Confession of a match maker', done: true }, { id: 's4', title: 'Collab reel - library crush', done: true }, { id: 's5', title: 'Promo reel - working but busy', done: true }, { id: 's6', title: 'Promo reel - hate dating apps', done: true }] },
  { id: 't17', title: 'Journal', categoryId: 'personal', column: 'done', createdAt: '2026-05-31', completedAt: '2026-05-31' },
  { id: 't18', title: 'Organise desk', categoryId: 'personal', column: 'done', createdAt: '2026-05-23', completedAt: '2026-05-23' },
  { id: 't19', title: 'Question for venues', categoryId: 'work', column: 'done', createdAt: '2026-05-23', completedAt: '2026-05-23' },
];

const DEFAULT_HABITS: Habit[] = [
  { id: 'h1', name: '5AM Wake Up', emoji: '⏰', completedDates: ['2026-05-25','2026-05-26','2026-05-27','2026-05-28','2026-05-29','2026-05-30','2026-05-31'] },
  { id: 'h2', name: 'Exercise', emoji: '🏃', completedDates: ['2026-05-25','2026-05-26','2026-05-27','2026-05-28','2026-05-29','2026-05-30','2026-05-31'] },
  { id: 'h3', name: 'Journal', emoji: '✍️', completedDates: ['2026-05-25','2026-05-27','2026-05-28','2026-05-29','2026-05-30','2026-05-31'] },
  { id: 'h4', name: 'Read 10 pages', emoji: '📚', completedDates: ['2026-05-27','2026-05-28','2026-05-29'] },
  { id: 'h5', name: 'Meditate', emoji: '🧘', completedDates: ['2026-05-29','2026-05-30'] },
  { id: 'h6', name: 'No scroll before 9am', emoji: '📵', completedDates: ['2026-05-25','2026-05-27','2026-05-28','2026-05-29'] },
];

const DEFAULT_GOALS: Goal[] = [
  { id: 'g1', title: 'Grow TikTok to 10K', categoryId: 'planning', progress: 24, current: '2,400', target: '10,000 followers' },
  { id: 'g2', title: 'Read 12 books this year', categoryId: 'personal', progress: 42, current: '5', target: '12 books' },
  { id: 'g3', title: 'Launch portfolio site', categoryId: 'work', progress: 20, target: 'Go live' },
];

const DEFAULT_MOOD: MoodEntry[] = [
  { date: '2026-05-25', mood: 3, sleep: 6.5, intention: 'Focus on Type deck', focus: 'Type W2 deck' },
  { date: '2026-05-26', mood: 3.5, sleep: 7, intention: 'Ship something', focus: 'Telegram bot' },
  { date: '2026-05-27', mood: 3, sleep: 6, intention: 'Deep work day', focus: 'Quiz feature' },
  { date: '2026-05-28', mood: 4.5, sleep: 8, intention: 'Content creation', focus: 'Reels content' },
  { date: '2026-05-29', mood: 4, sleep: 7.5, intention: 'Build momentum', focus: 'Type platform' },
  { date: '2026-05-30', mood: 3.8, sleep: 7, intention: 'Stay focused', focus: 'Co-founder search' },
];

const DEFAULT_EVENING: EveningEntry[] = [
  { date: '2026-05-28', location: 'Singapore', title: '有光的地方 ♥', rating: 8, highlights: [{ type: '+', text: 'Pleasant surprise with female sign ups' }, { type: '+', text: 'Walk in the park' }, { type: '+', text: '2x movies — Ratatouille <3' }, { type: '-', text: 'Procrastinated to wake up' }], freeWrite: '' },
];

const DEFAULT_ROADMAP_PROJECTS: RoadmapProject[] = [
  { id: 'rp1', name: 'Type Platform', emoji: '💎', color: '#2E86C1', startMonth: 1, endMonth: 7, progress: 58, milestones: [{ month: 3, label: 'Beta' }, { month: 6, label: 'Launch' }] },
  { id: 'rp2', name: 'TikTok Growth', emoji: '📱', color: '#F0B429', startMonth: 0, endMonth: 11, progress: 42, milestones: [{ month: 4, label: '5K' }, { month: 8, label: '10K' }] },
  { id: 'rp3', name: 'Portfolio Site', emoji: '🌐', color: '#4A7C59', startMonth: 3, endMonth: 5, progress: 80, milestones: [{ month: 5, label: 'Live' }] },
  { id: 'rp4', name: 'ADHD Tool', emoji: '🧠', color: '#C4A882', startMonth: 5, endMonth: 9, progress: 10, milestones: [{ month: 7, label: 'MVP' }] },
];

function getDefaultState(): AppState {
  return {
    userProfile: { name: 'TH', bio: 'Building the future, one day at a time.', avatarUrl: '' },
    focusMode: 'life',
    categories: DEFAULT_CATEGORIES,
    tasks: DEFAULT_TASKS,
    habits: DEFAULT_HABITS,
    moodEntries: DEFAULT_MOOD,
    eveningEntries: DEFAULT_EVENING,
    goals: DEFAULT_GOALS,
    reflections: [],
    roadmapProjects: DEFAULT_ROADMAP_PROJECTS,
    quarterlyGoal: { text: 'Build & launch Type — the modern speed dating platform.', progress: 58, daysLeft: 29 },
    checkinDone: false,
    streak: 7,
    monthlyIntention: 'Build the Type platform MVP and hit 100 sign-ups.',
  };
}

const STORAGE_KEY = '2nd-brain-state';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...getDefaultState(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultState();
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getCategoryById(state: AppState, id: string): Category | undefined {
  return state.categories.find(c => c.id === id);
}

/** Returns local date string YYYY-MM-DD without UTC conversion (avoids timezone shift) */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function getTodayString(): string {
  return toLocalDateStr(new Date());
}

export function getWeekDates(): string[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toLocalDateStr(d);
  });
}

export function getStreak(habits: Habit[]): number {
  // Count consecutive days where at least one habit was completed
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toLocalDateStr(d);
    const anyDone = habits.some(h => h.completedDates.includes(ds));
    if (anyDone) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function autoClassify(title: string, categories: Category[]): string {
  const lower = title.toLowerCase();
  for (const cat of categories) {
    if (cat.keywords.some(k => lower.includes(k))) return cat.id;
  }
  return 'work';
}

export function filterTasksByMode(tasks: Task[], mode: AppState['focusMode']): Task[] {
  if (mode === 'life') return tasks;
  if (mode === 'work') return tasks.filter(t => t.categoryId === 'work' || t.categoryId === 'planning' || t.categoryId === 'research');
  if (mode === 'personal') return tasks.filter(t => t.categoryId === 'personal' || t.categoryId === 'ideas' || t.categoryId === 'exercise');
  return tasks;
}
