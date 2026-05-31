import { useApp } from '@/contexts/AppContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import BackButton from '@/components/BackButton';

const COLORS = ['#2E86C1', '#5DADE2', '#F0B429', '#4A7C59', '#C4A882', '#C0392B'];

const STAT_CARDS = [
  { key: 'tasks', label: 'Task rate', bg: 'bg-[#E8F4FB]', text: 'text-[#2471A3]', border: 'border-[#BDD8EF]' },
  { key: 'habits', label: 'Habit score', bg: 'bg-[#E8F8F2]', text: 'text-[#2E8B57]', border: 'border-[#B2DFC8]' },
  { key: 'mood', label: 'Avg mood', bg: 'bg-[#FEF5E0]', text: 'text-[#C9952A]', border: 'border-[#F0D89A]' },
  { key: 'goal', label: 'Q2 progress', bg: 'bg-[#F0EDF8]', text: 'text-[#6B5EA8]', border: 'border-[#C9C0E8]' },
];

export default function Analytics() {
  const { state } = useApp();

  const moodData = state.moodEntries.slice(-7).map(e => ({
    day: e.date.slice(5),
    mood: e.mood,
    sleep: e.sleep,
  }));

  const catCounts: Record<string, number> = {};
  state.tasks.forEach(t => {
    catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + 1;
  });
  const pieData = Object.entries(catCounts).map(([id, count]) => {
    const cat = state.categories.find(c => c.id === id);
    return { name: cat?.name || id, value: count };
  });

  const completedThisWeek = state.tasks.filter(t => t.column === 'done').length;
  const totalTasks = state.tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedThisWeek / totalTasks) * 100) : 0;

  const habitScore = (() => {
    const today = new Date(2026, 4, 31);
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    const total = state.habits.length * 7;
    const done = state.habits.reduce((a, h) => a + last7.filter(d => h.completedDates.includes(d)).length, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  })();

  const avgMood = moodData.length ? (moodData.reduce((a, e) => a + e.mood, 0) / moodData.length).toFixed(1) : '—';
  const weeklyScore = Math.round(completionRate * 0.25 + habitScore * 0.25 + (parseFloat(String(avgMood)) || 3) / 5 * 100 * 0.2 + state.quarterlyGoal.progress * 0.3);

  const statValues = [
    `${completionRate}%`,
    `${habitScore}%`,
    `${avgMood}/5`,
    `${state.quarterlyGoal.progress}%`,
  ];

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">📈 Analytics</div>
          <div className="topbar-sub">Week of 25–31 May 2026</div>
        </div>
      </div>

      {/* WEEKLY SCORE HERO */}
      <div className="mx-4 mt-4 p-5 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Weekly Score</p>
        <div className="flex items-end gap-3">
          <span className="font-['Playfair_Display'] font-bold text-5xl">{weeklyScore}</span>
          <span className="text-white/70 text-lg mb-1">/100</span>
        </div>
        <p className="text-white/80 text-sm mt-1">
          {weeklyScore >= 80 ? '🔥 Empire mode activated.' : weeklyScore >= 60 ? '💪 Solid. Push harder.' : '📈 The mountain is still ahead.'}
        </p>
      </div>

      {/* COLOURED STAT CARDS */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        {STAT_CARDS.map((s, i) => (
          <div key={s.key} className={`p-4 rounded-2xl border ${s.bg} ${s.border}`}>
            <p className={`font-bold text-2xl font-['Playfair_Display'] ${s.text}`}>{statValues[i]}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* MOOD + SLEEP CHART — fixed width, scrollable */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">😊 Mood & Sleep (last 7 days)</p>
        <div className="chart-container">
          <div className="chart-inner" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={moodData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 10]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="mood" stroke="#2E86C1" strokeWidth={2} dot={{ r: 3 }} name="Mood" />
                <Line type="monotone" dataKey="sleep" stroke="#F0B429" strokeWidth={2} dot={{ r: 3 }} name="Sleep (h)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2E86C1]" /><span className="text-[11px] text-[var(--muted-foreground)]">Mood</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F0B429]" /><span className="text-[11px] text-[var(--muted-foreground)]">Sleep (h)</span></div>
        </div>
      </div>

      {/* TIME BY CATEGORY */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">🗂️ Tasks by Category</p>
        <div className="flex gap-4 items-center">
          <div style={{ width: 120, height: 120, flexShrink: 0 }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-[var(--foreground)] flex-1 truncate">{d.name}</span>
                <span className="text-xs font-bold text-[var(--muted-foreground)]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GOAL ALIGNMENT */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">💎 Goal Alignment</p>
        <div className="chart-container">
          <div className="chart-inner" style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={pieData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* INSIGHT CARD */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-[var(--gold-glow)] border border-[var(--gold)]/20">
        <p className="text-sm font-semibold text-[var(--gold)] mb-1">💡 This week's insight</p>
        <p className="text-sm text-[var(--foreground)] leading-relaxed">
          You complete <strong>40% more tasks</strong> on days after 7+ hours of sleep. Your best productivity window is <strong>9am–12pm</strong>.
        </p>
      </div>
    </div>
  );
}
