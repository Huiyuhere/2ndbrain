import { Link } from 'wouter';
import { useApp } from '@/contexts/AppContext';

const MORE_ITEMS = [
  { href: '/reflections', emoji: '🌙', title: 'Reflections', desc: 'Weekly, monthly & quarterly reviews' },
  { href: '/roadmap',     emoji: '🏔️', title: 'Roadmap',     desc: 'Gantt chart & milestone tracker' },
  { href: '/analytics',   emoji: '📈', title: 'Analytics',   desc: 'Mood, sleep, habits & time insights' },
  { href: '/goals',       emoji: '💎', title: 'Goals',       desc: 'Quarterly focus & custom goals' },
  { href: '/settings',    emoji: '⚙️', title: 'Settings',    desc: 'Categories, reminders & preferences' },
];

export default function More() {
  const { state } = useApp();

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">✦ More</div>
          <div className="topbar-sub">All features</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="streak-badge">🔥 {state.streak}</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>TH</div>
        </div>
      </div>

      {/* GOAL CARD */}
      <div className="mx-4 mt-3 p-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">👑 Q2 Focus Goal</p>
        <p className="text-white font-['Playfair_Display'] italic text-sm leading-snug">{state.quarterlyGoal.text}</p>
        <div className="mt-3 w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${state.quarterlyGoal.progress}%`, background: 'linear-gradient(90deg, #F0B429, #C9952A)' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[#F0B429] text-xs font-bold">{state.quarterlyGoal.progress}%</span>
          <span className="text-white/60 text-[10px]">{state.quarterlyGoal.daysLeft}d left</span>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-3 gap-2 mx-4 mt-4">
        {[
          { label: 'Tasks done', value: state.tasks.filter(t => t.column === 'done').length, emoji: '✅' },
          { label: 'Habit streak', value: `${state.streak}d`, emoji: '🔥' },
          { label: 'Mood avg', value: state.moodEntries.length ? (state.moodEntries.reduce((a, e) => a + e.mood, 0) / state.moodEntries.length).toFixed(1) : '—', emoji: '😊' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border border-[var(--border)] bg-white text-center">
            <p className="text-xl mb-1">{s.emoji}</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* LINKS */}
      <div className="px-4 mt-4 space-y-2">
        {MORE_ITEMS.map(item => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border)] bg-white hover:border-[var(--sky-light)] hover:shadow-sm transition-all active:scale-[0.98]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-[var(--sky-mist)] shrink-0">
                {item.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.desc}</p>
              </div>
              <span className="text-[var(--muted-foreground)] text-sm">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
