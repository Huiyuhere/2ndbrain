import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

export default function Goals() {
  const { state, updateQuarterlyGoal } = useApp();
  const [monthlyIntention, setMonthlyIntention] = useState('Build the Type platform MVP and hit 100 sign-ups.');
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState(state.quarterlyGoal.text);

  const customGoals = [
    { id: '1', title: 'Grow TikTok to 10K followers', progress: 42, emoji: '📱', target: '10,000', current: '4,200' },
    { id: '2', title: 'Launch Type platform', progress: 65, emoji: '🚀', target: 'Launch', current: 'MVP 65%' },
    { id: '3', title: 'Read 12 books this year', progress: 33, emoji: '📚', target: '12 books', current: '4 done' },
  ];

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">💎 Goals</div>
          <div className="topbar-sub">Q2 2026 · Apr – Jun</div>
        </div>
        <button onClick={() => toast.info('Add goal — coming soon')} className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky">+ Goal</button>
      </div>

      {/* Q2 FOCUS GOAL */}
      <div className="mx-4 mt-3 p-5 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">👑 Q2 Focus Goal</p>
            {editingGoal ? (
              <textarea
                className="w-full bg-white/20 text-white rounded-xl p-2 text-sm font-['Playfair_Display'] italic border border-white/30 outline-none resize-none"
                value={goalText}
                onChange={e => setGoalText(e.target.value)}
                rows={2}
              />
            ) : (
              <p className="text-white font-['Playfair_Display'] italic text-base leading-snug">{state.quarterlyGoal.text}</p>
            )}
          </div>
          <button onClick={() => {
            if (editingGoal) {
              updateQuarterlyGoal({ text: goalText });
              toast.success('Goal updated');
            }
            setEditingGoal(e => !e);
          }} className="text-white/60 text-xs shrink-0 mt-1">
            {editingGoal ? '✓ Save' : '✏️'}
          </button>
        </div>
        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full" style={{ width: `${state.quarterlyGoal.progress}%`, background: 'linear-gradient(90deg, #F0B429, #C9952A)' }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[#F0B429] text-sm font-bold">{state.quarterlyGoal.progress}% complete</span>
          <span className="text-white/60 text-xs">{state.quarterlyGoal.daysLeft} days left</span>
        </div>
      </div>

      {/* MONTHLY INTENTION */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">🌙 May Intention</p>
          <button onClick={() => setEditingMonthly(e => !e)} className="text-xs text-[var(--sky)] font-medium">{editingMonthly ? 'Save' : 'Edit'}</button>
        </div>
        {editingMonthly ? (
          <textarea
            className="input-field resize-none"
            rows={2}
            value={monthlyIntention}
            onChange={e => setMonthlyIntention(e.target.value)}
          />
        ) : (
          <p className="text-sm text-[var(--foreground)] font-['Playfair_Display'] italic leading-relaxed">{monthlyIntention}</p>
        )}
      </div>

      {/* CUSTOM GOALS */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">🎯 Custom Goals</div>
        <span className="section-hdr-action" onClick={() => toast.info('Add goal — coming soon')}>+ Add</span>
      </div>
      <div className="px-4 space-y-3">
        {customGoals.map(g => (
          <div key={g.id} className="p-4 rounded-2xl border border-[var(--border)] bg-white">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">{g.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{g.current} / {g.target}</span>
                  <span className="text-xs font-bold text-[var(--sky)]">{g.progress}%</span>
                </div>
                <div className="mt-2 w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${g.progress}%`, background: 'linear-gradient(90deg, #2E86C1, #5DADE2)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QUARTERLY REVIEW CTA */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-[var(--gold-glow)] border border-[var(--gold)]/20">
        <p className="text-sm font-semibold text-[var(--gold)] mb-1">📋 Quarterly Review</p>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">Q1 2026 review is ready. 30 mins to close the loop.</p>
        <a href="/reflections" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)]">
          Start Q1 Review →
        </a>
      </div>
    </div>
  );
}
