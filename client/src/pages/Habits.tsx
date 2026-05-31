import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getWeekDates, getTodayString } from '@/lib/store';
import GoalBanner from '@/components/GoalBanner';
import { toast } from 'sonner';

const DAYS_SHORT = ['M','T','W','T','F','S','S'];

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 4, 31);
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

export default function Habits() {
  const { state, toggleHabit } = useApp();
  const today = getTodayString();
  const last7 = getLastNDays(7);
  const [addingHabit, setAddingHabit] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⭐');

  function getStreak(completedDates: string[]): number {
    let streak = 0;
    const ref = new Date(2026, 4, 31);
    for (let i = 0; i < 30; i++) {
      const d = new Date(ref);
      d.setDate(ref.getDate() - i);
      const ds = d.toISOString().split('T')[0];
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

  const weekScore = getWeekScore();
  const todayMood = state.moodEntries.find(e => e.date === today);
  const avgSleep = state.moodEntries.length
    ? (state.moodEntries.reduce((a, e) => a + e.sleep, 0) / state.moodEntries.length).toFixed(1)
    : '—';

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">🔥 Habits</div>
          <div className="topbar-sub">Week of 25–31 May 2026</div>
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
            const date = new Date(d);
            const isToday = d === today;
            return (
              <div key={i} className={`w-9 text-center text-[11px] font-semibold ${isToday ? 'text-[var(--sky)]' : 'text-[var(--muted-foreground)]'}`}>
                {DAYS_SHORT[date.getDay()]}
              </div>
            );
          })}
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
                      className={`w-9 h-9 rounded-lg mx-0.5 flex items-center justify-center text-xs font-bold transition-all ${
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
              </div>
            );
          })}
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
        <p className="text-xs text-[var(--muted-foreground)] mt-2">
          💡 You complete <strong>40% more habits</strong> after 7+ hours of sleep.
        </p>
      </div>

      {/* ADD HABIT MODAL */}
      {addingHabit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddingHabit(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl p-6 pb-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-['Playfair_Display'] font-bold text-lg mb-4">Add new habit</h3>
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">Emoji</p>
              <div className="flex gap-2 flex-wrap">
                {['⏰','🏃','✍️','📚','🧘','📵','💧','🥗','🌅','💪'].map(e => (
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
              />
            </div>
            <button
              onClick={() => {
                if (!newName.trim()) return;
                toast.success(`Habit "${newName}" added!`);
                setAddingHabit(false);
                setNewName('');
              }}
              className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky"
            >
              Add habit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
