import { useApp } from '@/contexts/AppContext';
import { Link } from 'wouter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import BackButton from '@/components/BackButton';
import { getWeekDates, getTaskMinutes, getTodayString, getEstimationStats, getSleepHabitInsight, formatMinutes, getHoursByType, getHoursByCategory } from '@/lib/store';
import type { HourBreakdown } from '@/lib/store';

const COLORS = ['#2E86C1', '#5DADE2', '#F0B429', '#4A7C59', '#C4A882', '#C0392B'];

const STAT_CARDS = [
  { key: 'tasks', label: 'Task rate', bg: 'bg-[#E8F4FB]', text: 'text-[#2471A3]', border: 'border-[#BDD8EF]' },
  { key: 'habits', label: 'Habit score', bg: 'bg-[#E8F8F2]', text: 'text-[#2E8B57]', border: 'border-[#B2DFC8]' },
  { key: 'mood', label: 'Avg mood', bg: 'bg-[#FEF5E0]', text: 'text-[#C9952A]', border: 'border-[#F0D89A]' },
  { key: 'goal', label: 'Q2 progress', bg: 'bg-[#F0EDF8]', text: 'text-[#6B5EA8]', border: 'border-[#C9C0E8]' },
];

export default function Analytics() {
  const { state } = useApp();

  // Aggregate mood per day from both morning and evening entries
  const moodData = (() => {
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    return last7Dates.map(date => {
      const morning = state.moodEntries.find(e => e.date === date);
      const evening = state.eveningEntries.find(e => e.date === date);
      const moods = [morning?.mood, evening?.moodScore].filter((v): v is number => v !== undefined);
      const avgMoodVal = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : undefined;
      return {
        day: date.slice(5),
        mood: avgMoodVal !== undefined ? parseFloat(avgMoodVal.toFixed(1)) : undefined,
        sleep: morning?.sleep,
      };
    }).filter(d => d.mood !== undefined || d.sleep !== undefined);
  })();

  // ── Hour-weighted task metrics ────────────────────────────────────────────
  // Sum hours per category (falls back to 1h per task if no duration tag)
  const catHours: Record<string, number> = {};
  let totalPlannedHours = 0;
  let completedHours = 0;
  state.tasks.forEach(t => {
    const mins = getTaskMinutes(t);
    const hrs = mins > 0 ? mins / 60 : 1; // default 1h if untagged
    catHours[t.categoryId] = (catHours[t.categoryId] || 0) + hrs;
    totalPlannedHours += hrs;
    if (t.column === 'done') completedHours += hrs;
  });
  const pieData = Object.entries(catHours).map(([id, hrs]) => {
    const cat = state.categories.find(c => c.id === id);
    return { name: cat?.name || id, value: parseFloat(hrs.toFixed(1)) };
  });

  // ── Side-by-side: hours by type vs hours by category ──────────────────────
  const hoursByType = getHoursByType(state.tasks);
  const hoursByCategory = getHoursByCategory(state.tasks, state.categories);
  const maxPanelHours = Math.max(
    1,
    ...hoursByType.map(r => r.hours),
    ...hoursByCategory.map(r => r.hours),
  );

  // Completion rate weighted by hours
  const completionRate = totalPlannedHours > 0 ? Math.round((completedHours / totalPlannedHours) * 100) : 0;
  const hoursLogged = parseFloat(completedHours.toFixed(1));

  const habitScore = (() => {
    const todayStr = getTodayString();
    const now = new Date();
    const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sgt); d.setUTCDate(sgt.getUTCDate() - i);
      const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,'0'), day = String(d.getUTCDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    });
    const total = state.habits.length * 7;
    const done = state.habits.reduce((a, h) => a + last7.filter(d => h.completedDates.includes(d)).length, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  })();

  const avgMood = moodData.length ? (moodData.reduce((a, e) => a + (e.mood ?? 0), 0) / moodData.filter(e => e.mood !== undefined).length).toFixed(1) : '—';
  const weeklyScore = Math.round(completionRate * 0.25 + habitScore * 0.25 + (parseFloat(String(avgMood)) || 3) / 5 * 100 * 0.2 + state.quarterlyGoal.progress * 0.3);

  const statValues = [
    `${completionRate}%`,
    `${habitScore}%`,
    `${avgMood}/5`,
    `${state.quarterlyGoal.progress}%`,
  ];

  // ── Estimation accuracy by task type ───────────────────────────────────────
  const estStats = getEstimationStats(state.tasks);
  const estChartData = estStats.map(s => ({
    name: `${s.emoji} ${s.label}`,
    diff: s.diffPct,
    fill: s.diffPct > 0 ? '#C0392B' : s.diffPct < 0 ? '#2E8B57' : '#ABA59D',
    count: s.count,
    est: s.estMinutes,
    act: s.actualMinutes,
  }));
  const mostUnder = estStats.find(s => s.diffPct > 0);
  const mostOver = [...estStats].reverse().find(s => s.diffPct < 0);

  // ── Real sleep insight (replaces hardcoded copy) ────────────────────────────
  const sleepInsight = getSleepHabitInsight(state.moodEntries, state.habits);

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">📈 Analytics</div>
          <div className="topbar-sub">{(() => {
            const dates = getWeekDates();
            const fmt = (s: string) => { const [,m,d] = s.split('-'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${parseInt(d)} ${months[parseInt(m)-1]}`; };
            return `Week of ${fmt(dates[0])} – ${fmt(dates[6])}`;
          })()}</div>
        </div>
      </div>

      {/* ASK MANUS — grounded analytics chat */}
      <Link
        href="/analytics/ask"
        className="mx-4 mt-4 flex items-center gap-3 p-4 rounded-2xl border border-[var(--sky)]/30 bg-gradient-to-br from-[var(--sky-mist)] to-white active:scale-[0.99] transition-transform"
        style={{ transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)' }}
      >
        <span className="text-2xl shrink-0">✨</span>
        <span className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold text-[var(--sky)]">Ask Manus</span>
          <span className="text-xs text-[var(--muted-foreground)] truncate">
            Dig deeper — ask anything about your data &amp; patterns
          </span>
        </span>
        <span className="text-[var(--sky)] text-lg shrink-0">→</span>
      </Link>

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
        {/* Hours logged — spans full width */}
        <div className="col-span-2 p-4 rounded-2xl border bg-[#FEF0E8] border-[#F2C4A0] flex items-center justify-between">
          <div>
            <p className="font-bold text-2xl font-['Playfair_Display'] text-[#C4704A]">{hoursLogged}h</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">Hours completed</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#C4704A]">{parseFloat(totalPlannedHours.toFixed(1))}h planned</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{completionRate}% by hours</p>
          </div>
        </div>
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

      {/* HOURS BY TYPE vs CATEGORY — side by side */}
      <div className="mx-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <HoursPanel title="🏷️ Hours by Type" rows={hoursByType} maxHours={maxPanelHours} />
        <HoursPanel title="🗂️ Hours by Category" rows={hoursByCategory} maxHours={maxPanelHours} />
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

      {/* ESTIMATION ACCURACY */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-1">⏱ Estimation Accuracy</p>
        <p className="text-[11px] text-[var(--muted-foreground)] mb-3">
          How your estimate compares to actual time, by task type. <span className="text-[#C0392B] font-semibold">Red = underestimated</span> (took longer), <span className="text-[#2E8B57] font-semibold">green = overestimated</span> (faster).
        </p>
        {estChartData.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Add a duration estimate (e.g. <strong>[1h]</strong> in the title) and log actual time when you complete tasks.</p>
          </div>
        ) : (
          <>
            <div className="chart-container">
              <div className="chart-inner" style={{ height: Math.max(120, estChartData.length * 38) }}>
                <ResponsiveContainer width="100%" height={Math.max(120, estChartData.length * 38)}>
                  <BarChart data={estChartData} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} domain={['dataMin', 'dataMax']} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={92} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(val: number, _n, p: { payload?: { count?: number; est?: number; act?: number } }) => {
                        const d = p.payload ?? {};
                        const label = val > 0 ? `${val}% over (underestimated)` : val < 0 ? `${Math.abs(val)}% under (overestimated)` : 'on target';
                        return [`${label} · ${d.count ?? 0} task${(d.count ?? 0) === 1 ? '' : 's'}`, 'Diff'];
                      }}
                    />
                    <Bar dataKey="diff" radius={[0, 4, 4, 0]}>
                      {estChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {estStats.map(s => (
                <div key={s.typeId} className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: s.color }}>{s.emoji} {s.label}</span>
                  <span className="text-[var(--muted-foreground)]">{formatMinutes(s.estMinutes)} est → {formatMinutes(s.actualMinutes)} actual</span>
                  <span className={`ml-auto font-bold ${s.diffPct > 0 ? 'text-[#C0392B]' : s.diffPct < 0 ? 'text-[#2E8B57]' : 'text-[var(--muted-foreground)]'}`}>
                    {s.diffPct > 0 ? '+' : ''}{s.diffPct}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* INSIGHT CARD */}
      <div className="mx-4 mt-4 mb-2 p-4 rounded-2xl bg-[var(--gold-glow)] border border-[var(--gold)]/20">
        <p className="text-sm font-semibold text-[var(--gold)] mb-1">💡 This week's insight</p>
        {(mostUnder || mostOver) ? (
          <p className="text-sm text-[var(--foreground)] leading-relaxed">
            {mostUnder && <>You most <strong>underestimate</strong> {mostUnder.emoji} <strong>{mostUnder.label}</strong> tasks (by ~{mostUnder.diffPct}%). </>}
            {mostOver && <>You tend to <strong>overestimate</strong> {mostOver.emoji} <strong>{mostOver.label}</strong> tasks (~{Math.abs(mostOver.diffPct)}% faster). </>}
          </p>
        ) : (
          <p className="text-sm text-[var(--foreground)] leading-relaxed">
            Log actual time on a few estimated tasks to see which task types you over- or under-estimate.
          </p>
        )}
        {sleepInsight && sleepInsight.pctMore !== 0 && (
          <p className="text-sm text-[var(--foreground)] leading-relaxed mt-2">
            😴 You complete <strong>{Math.abs(sleepInsight.pctMore)}% {sleepInsight.pctMore > 0 ? 'more' : 'fewer'}</strong> habits on days after 7+ hours of sleep <span className="text-[var(--muted-foreground)]">(based on {sleepInsight.goodDays + sleepInsight.lowDays} days logged)</span>.
          </p>
        )}
      </div>
    </div>
  );
}

/** Equal-size panel: a titled card with horizontal hour bars per row. */
function HoursPanel({ title, rows, maxHours }: { title: string; rows: HourBreakdown[]; maxHours: number }) {
  const total = rows.reduce((a, r) => a + r.hours, 0);
  return (
    <div className="p-4 rounded-2xl border border-[var(--border)] bg-white flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <span className="text-[11px] text-[var(--muted-foreground)]">{Math.round(total * 10) / 10}h total</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <p className="text-sm text-[var(--muted-foreground)]">No tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--foreground)] truncate flex items-center gap-1.5">
                  <span>{r.emoji}</span>{r.label}
                </span>
                <span className="text-xs font-bold text-[var(--muted-foreground)] shrink-0 ml-2">{r.hours}h</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${maxHours > 0 ? (r.hours / maxHours) * 100 : 0}%`, background: r.color, '--ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)' } as React.CSSProperties}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
