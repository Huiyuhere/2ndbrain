import { useState } from 'react';
import { toast } from 'sonner';

type Project = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  startMonth: number; // 0-indexed from Jan 2026
  endMonth: number;
  progress: number;
  milestones: { month: number; label: string }[];
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const INITIAL_PROJECTS: Project[] = [
  {
    id: '1', name: 'Type Platform', emoji: '💎', color: '#2E86C1',
    startMonth: 1, endMonth: 7, progress: 58,
    milestones: [{ month: 3, label: 'Beta' }, { month: 6, label: 'Launch' }],
  },
  {
    id: '2', name: 'TikTok Growth', emoji: '📱', color: '#F0B429',
    startMonth: 0, endMonth: 11, progress: 42,
    milestones: [{ month: 4, label: '5K' }, { month: 8, label: '10K' }],
  },
  {
    id: '3', name: 'Portfolio Site', emoji: '🌐', color: '#4A7C59',
    startMonth: 3, endMonth: 5, progress: 80,
    milestones: [{ month: 5, label: 'Live' }],
  },
  {
    id: '4', name: 'ADHD Tool', emoji: '🧠', color: '#C4A882',
    startMonth: 5, endMonth: 9, progress: 10,
    milestones: [{ month: 7, label: 'MVP' }],
  },
];

const TODAY_MONTH = 4; // May (0-indexed)

export default function Roadmap() {
  const [projects] = useState<Project[]>(INITIAL_PROJECTS);
  const [view, setView] = useState<'year' | 'q'>('year');

  const visibleMonths = view === 'year' ? MONTHS : MONTHS.slice(3, 7); // Q2: Apr-Jul
  const startOffset = view === 'year' ? 0 : 3;
  const totalMonths = visibleMonths.length;

  function getBarStyle(p: Project) {
    const start = Math.max(p.startMonth - startOffset, 0);
    const end = Math.min(p.endMonth - startOffset, totalMonths - 1);
    if (start > totalMonths - 1 || end < 0) return null;
    const left = (start / totalMonths) * 100;
    const width = ((end - start + 1) / totalMonths) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }

  function getMilestoneLeft(month: number) {
    const rel = month - startOffset;
    if (rel < 0 || rel > totalMonths - 1) return null;
    return `${((rel + 0.5) / totalMonths) * 100}%`;
  }

  const todayLeft = `${((TODAY_MONTH - startOffset + 0.5) / totalMonths) * 100}%`;
  const todayVisible = TODAY_MONTH >= startOffset && TODAY_MONTH < startOffset + totalMonths;

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">🏔️ Roadmap</div>
          <div className="topbar-sub">2026 Timeline</div>
        </div>
        <button onClick={() => toast.info('Add project — coming soon')} className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky">+ Project</button>
      </div>

      {/* VIEW TOGGLE */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          <button className={`tab-btn ${view === 'year' ? 'active' : ''}`} onClick={() => setView('year')}>📅 Full Year</button>
          <button className={`tab-btn ${view === 'q' ? 'active' : ''}`} onClick={() => setView('q')}>🎯 Q2 Focus</button>
        </div>
      </div>

      {/* GANTT CHART */}
      <div className="mx-4 mt-2 bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
        {/* Month headers */}
        <div className="flex border-b border-[var(--border)] bg-[var(--muted)]">
          <div className="w-28 shrink-0 px-3 py-2 text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Project</div>
          <div className="flex-1 flex">
            {visibleMonths.map((m, i) => {
              const isToday = i + startOffset === TODAY_MONTH;
              return (
                <div key={i} className={`flex-1 text-center py-2 text-[10px] font-semibold ${isToday ? 'text-[var(--sky)] font-bold' : 'text-[var(--muted-foreground)]'}`}>
                  {m}
                </div>
              );
            })}
          </div>
        </div>

        {/* Project rows */}
        {projects.map(p => {
          const barStyle = getBarStyle(p);
          return (
            <div key={p.id} className="flex items-center border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 transition-colors">
              <div className="w-28 shrink-0 px-3 py-3 flex items-center gap-2">
                <span className="text-base">{p.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--foreground)] truncate">{p.name}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">{p.progress}%</p>
                </div>
              </div>
              <div className="flex-1 relative py-3 pr-2" style={{ height: '52px' }}>
                {/* Today line */}
                {todayVisible && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-[var(--sky)] z-10 opacity-60"
                    style={{ left: todayLeft }}
                  />
                )}

                {/* Bar */}
                {barStyle && (
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full overflow-hidden" style={barStyle}>
                    <div className="h-full w-full opacity-20 rounded-full" style={{ background: p.color }} />
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ width: `${p.progress}%`, background: p.color }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-white text-[10px] font-bold truncate" style={{ color: 'white', mixBlendMode: 'difference' }}>
                      {p.name}
                    </span>
                  </div>
                )}

                {/* Milestones */}
                {p.milestones.map((m, i) => {
                  const left = getMilestoneLeft(m.month);
                  if (!left) return null;
                  return (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 z-20 group" style={{ left }}>
                      <div className="milestone-diamond" style={{ background: '#F0B429' }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[var(--foreground)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {m.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* LEGEND */}
      <div className="mx-4 mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[var(--sky)]" />
          Progress
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 rounded-sm" style={{ background: '#F0B429' }} />
          Milestone
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-[var(--sky)]" />
          Today
        </div>
      </div>

      {/* UPCOMING MILESTONES */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">⭐ Upcoming Milestones</div>
      </div>
      <div className="px-4 space-y-2">
        {projects.flatMap(p => p.milestones.map(m => ({ ...m, project: p }))).filter(m => m.month >= TODAY_MONTH).sort((a, b) => a.month - b.month).slice(0, 4).map((m, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[var(--border)]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: m.project.color + '20' }}>
              {m.project.emoji}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">{m.label}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{m.project.name} · {MONTHS[m.month]} 2026</p>
            </div>
            <div className="w-2 h-2 rotate-45 rounded-sm" style={{ background: '#F0B429' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
