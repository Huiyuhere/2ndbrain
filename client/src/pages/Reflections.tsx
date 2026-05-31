import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

type Tab = 'weekly' | 'monthly' | 'quarterly';

const WEEKLY_PROMPTS = [
  { q: '🏆 What were my 3 biggest wins this week?', key: 'wins' },
  { q: '🧠 What did I learn or discover?', key: 'learned' },
  { q: '⚡ What drained my energy? What gave me energy?', key: 'energy' },
  { q: '🎯 Did I work on what actually matters?', key: 'alignment' },
  { q: '🔮 What is my #1 intention for next week?', key: 'nextWeek' },
];

const MONTHLY_PROMPTS = [
  { q: '📊 How did this month compare to my intention?', key: 'monthVsIntention' },
  { q: '💡 What is the most important thing I learned?', key: 'bigLesson' },
  { q: '🌊 What am I most proud of?', key: 'proud' },
  { q: '🔧 What needs to change next month?', key: 'change' },
  { q: '🌙 Set your intention for next month:', key: 'nextMonth' },
];

const QUARTERLY_PROMPTS = [
  { q: '👑 Did I achieve my Q2 Focus Goal? What happened?', key: 'goalReview' },
  { q: '📈 What moved the needle most this quarter?', key: 'leverage' },
  { q: '🏔️ What did I avoid that I should have faced?', key: 'avoided' },
  { q: '💎 What am I building that I am most proud of?', key: 'proud' },
  { q: '🔮 What is my Q3 Focus Goal?', key: 'nextGoal' },
  { q: '🌊 What does my ideal Q3 look like?', key: 'vision' },
];

export default function Reflections() {
  const [tab, setTab] = useState<Tab>('weekly');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const prompts = tab === 'weekly' ? WEEKLY_PROMPTS : tab === 'monthly' ? MONTHLY_PROMPTS : QUARTERLY_PROMPTS;

  function save() {
    toast.success('Reflection saved ✨');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tabLabels: Record<Tab, string> = { weekly: '📋 Weekly', monthly: '🌙 Monthly', quarterly: '👑 Quarterly' };

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <div className="topbar-title">🌙 Reflections</div>
          <div className="topbar-sub">31 May 2026</div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          {(['weekly', 'monthly', 'quarterly'] as Tab[]).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setAnswers({}); }}>
              {tabLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* CONTEXT CARD */}
      <div className="mx-4 mb-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-xs text-[var(--muted-foreground)] font-semibold uppercase tracking-wider mb-1">
          {tab === 'weekly' ? '📅 Week of 25–31 May 2026' : tab === 'monthly' ? '🗓️ May 2026' : '📊 Q2 2026 · Apr–Jun'}
        </p>
        <p className="text-sm text-[var(--foreground)] leading-relaxed font-['Playfair_Display'] italic">
          {tab === 'weekly'
            ? '"The secret is to work less as individuals and more as a team."'
            : tab === 'monthly'
            ? 'May intention: Build the Type platform MVP and hit 100 sign-ups.'
            : '"Build a million dollar empire. One brick at a time."'}
        </p>
      </div>

      {/* PROMPTS */}
      <div className="px-4 space-y-4">
        {prompts.map(p => (
          <div key={p.key} className="prompt-block">
            <div className="prompt-q">{p.q}</div>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Write freely..."
              value={answers[p.key] || ''}
              onChange={e => setAnswers(a => ({ ...a, [p.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="px-4 mt-4">
        <button onClick={save} className={`w-full py-3.5 rounded-2xl text-white font-bold transition-all ${saved ? 'bg-green-500' : 'btn-sky'}`}>
          {saved ? '✓ Saved!' : `Save ${tab} reflection`}
        </button>
      </div>
    </div>
  );
}
