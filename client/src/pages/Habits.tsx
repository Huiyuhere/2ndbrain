import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getTodayString, toLocalDateStr, getSleepHabitInsight } from '@/lib/store';
import GoalBanner from '@/components/GoalBanner';
import { toast } from 'sonner';

const DAYS_SHORT = ['M','T','W','T','F','S','S'];

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return toLocalDateStr(d);
  });
}

function getWeekLabel(dates: string[]): string {
  if (!dates.length) return '';
  const fmt = (s: string) => {
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

const EMOJI_OPTIONS = ['⏰','🏃','✍️','📚','🧘','📵','💧','🥗','🌅','💪','🎯','🧠','🌿','🎨','🎵'];

export default function Habits() {
  const { state, toggleHabit, addHabit, deleteHabit } = useApp();
  const today = getTodayString();
  const last7 = getLastNDays(7);
  const [addingHabit, setAddingHabit] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⭐');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function getStreak(completedDates: string[]): number {
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = toLocalDateStr(d);
      if (completedDates.includes(ds)) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  function getWeekScore(): number {
    const total = state.habits.length * 7;
    const done = state.habits.reduce((acc, h) => acc + last7.filter(d => h.completedDates.includes(d)).length, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function handleAddHabit() {
    if (!newName.trim()) return;
    addHabit({ name: newName.trim(), emoji: newEmoji });
    toast.success(`Habit "${newName.trim()}" added!`);
    setAddingHabit(false);
    setNewName('');
    setNewEmoji('⭐');
  }

  function handleDeleteHabit(id: string, name: string) {
    deleteHabit(id);
    toast.success(`Habit "${name}" removed`);
    setConfirmDelete(null);
  }

  const weekScore = getWeekScore();
  const todayMood = state.moodEntries.find(e => e.date === today);
  const avgSleep = state.moodEntries.length
    ? (state.moodEntries.reduce((a, e) => a + e.sleep, 0) / state.moodEntries.length).toFixed(1)
    : '—';
  const sleepInsight = getSleepHabitInsight(state.moodEntries, state.habits);

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">🔥 Habits</div>
          <div className="topbar-sub">{getWeekLabel(last7)}</div>
        </div>
        <button
          onClick={() => setAddingHabit(true)}
          className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky"
        >
          + Add
        </button>
      </div>

      <GoalBanner compact />

      {/* WEEKLY SCORE */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="url(#scoreGrad)" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * (1 - weekScore / 100)}`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2E86C1" />
                <stop offset="100%" stopColor="#5DADE2" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--sky)]">{weekScore}%</span>
          </div>
        </div>
        <div>
          <p className="font-semibold text-[var(--foreground)]">Weekly Habit Score</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {weekScore >= 80 ? '🔥 Crushing it!' : weekScore >= 60 ? '💪 Solid week' : '📈 Keep building'}
          </p>
          <div className="flex gap-3 mt-2">
            <div className="text-center">
              <p className="text-xs font-bold text-[var(--sky)]">{avgSleep}h</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">Avg sleep</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-[var(--gold)]">{todayMood?.mood ?? '—'}/5</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">Today mood</p>
            </div>
          </div>
        </div>
      </div>

      {/* HABIT GRID */}
      <div className="mx-4 mt-4">
        {/* Day headers */}
        <div className="flex items-center mb-2">
          <div className="flex-1" />
          {last7.map((d, i) => {
            const date = new Date(d + 'T12:00:00');
            const isToday = d === today;
            return (
              <div key={i} className={`w-9 text-center text-[11px] font-semibold ${isToday ? 'text-[var(--sky)]' : 'text-[var(--muted-foreground)]'}`}>
                {DAYS_SHORT[(date.getDay() + 6) % 7]}
              </div>
            );
          })}
          {/* spacer for delete col */}
          <div className="w-8" />
        </div>

        {/* Habit rows */}
        <div className="space-y-2">
          {state.habits.map(h => {
            const streak = getStreak(h.completedDates);
            const weekDone = last7.filter(d => h.completedDates.includes(d)).length;
            return (
              <div key={h.id} className="flex items-center bg-white rounded-xl border border-[var(--border)] px-3 py-2.5">
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-lg">{h.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{h.name}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">🔥 {streak} streak · {weekDone}/7 this week</p>
                  </div>
                </div>
                {last7.map((d, i) => {
                  const done = h.completedDates.includes(d);
                  const isToday = d === today;
                  return (
                    <button
                      key={i}
                      onClick={() => toggleHabit(h.id, d)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                        done
                          ? 'text-white shadow-sm'
                          : isToday
                          ? 'border-2 border-[var(--sky)] text-[var(--sky)] bg-[var(--sky-mist)]'
                          : 'border border-[var(--border)] text-[var(--muted-foreground)] bg-white'
                      }`}
                      style={done ? { background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' } : {}}
                    >
                      {done ? '✓' : ''}
                    </button>
                  );
                })}
                {/* Delete button */}
                <button
                  onClick={() => setConfirmDelete(h.id)}
                  className="w-8 h-8 ml-1 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-base leading-none"
                  title="Delete habit"
                >
                  ×
                </button>
              </div>
            );
          })}

          {state.habits.length === 0 && (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <p className="text-2xl mb-2">🌱</p>
              <p className="text-sm">No habits yet. Add your first one!</p>
            </div>
          )}
        </div>
      </div>

      {/* SLEEP INSIGHT */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">😴 Sleep this week</p>
        <div className="flex items-end gap-1.5 h-16">
          {state.moodEntries.slice(-7).map((e, i) => {
            const pct = (e.sleep / 10) * 100;
            const isGood = e.sleep >= 7;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${pct}%`,
                    background: isGood ? 'linear-gradient(180deg, #2E86C1, #5DADE2)' : '#DDD9D2',
                    minHeight: '4px',
                  }}
                />
                <span className="text-[9px] text-[var(--muted-foreground)]">{e.sleep}h</span>
              </div>
            );
          })}
        </div>
        {sleepInsight && sleepInsight.pctMore !== 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            💡 You complete <strong>{Math.abs(sleepInsight.pctMore)}% {sleepInsight.pctMore > 0 ? 'more' : 'fewer'}</strong> habits after 7+ hours of sleep.
          </p>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            💡 Log a few more days of sleep to unlock your sleep-vs-habits insight.
          </p>
        )}
      </div>

      {/* ADD HABIT MODAL — centered */}
      {addingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddingHabit(false)} />
          <div className="relative w-full max-w-[420px] mx-4 bg-white rounded-3xl p-6 shadow-2xl">
            <h3 className="font-['Playfair_Display'] font-bold text-lg mb-1">Add new habit</h3>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">Build your daily ritual, one habit at a time.</p>
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">Choose an emoji</p>
              <div className="flex gap-2 flex-wrap">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setNewEmoji(e)}
                    className={`w-10 h-10 rounded-xl text-xl border-2 transition-all ${newEmoji === e ? 'border-[var(--sky)] bg-[var(--sky-mist)]' : 'border-[var(--border)]'}`}
                  >{e}</button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm font-semibold mb-2">Habit name</p>
              <input
                className="input-field"
                placeholder="e.g. Morning walk"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setAddingHabit(false); setNewName(''); }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-[var(--border)] text-[var(--muted-foreground)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddHabit}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-2xl text-white font-bold btn-sky disabled:opacity-40"
              >
                Add habit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL — centered */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-[360px] mx-4 bg-white rounded-3xl p-6 shadow-2xl text-center">
            <p className="text-3xl mb-3">🗑️</p>
            <h3 className="font-['Playfair_Display'] font-bold text-base mb-2">Delete this habit?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Your streak and history will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-[var(--border)]"
              >
                Keep it
              </button>
              <button
                onClick={() => {
                  const h = state.habits.find(h => h.id === confirmDelete);
                  if (h) handleDeleteHabit(h.id, h.name);
                }}
                className="flex-1 py-3 rounded-2xl text-white font-bold bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
