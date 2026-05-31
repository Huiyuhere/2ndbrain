import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '@/components/BackButton';

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

const PROMPTS_MAP = { weekly: WEEKLY_PROMPTS, monthly: MONTHLY_PROMPTS, quarterly: QUARTERLY_PROMPTS };

const TAB_LABELS: Record<Tab, string> = { weekly: '📋 Weekly', monthly: '🌙 Monthly', quarterly: '👑 Quarterly' };

const TODAY = '2026-05-31';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getFirstAnswer(answers: Record<string, string>): string {
  const first = Object.values(answers).find(v => v.trim());
  return first ? first.slice(0, 80) + (first.length > 80 ? '…' : '') : 'No answers recorded.';
}

export default function Reflections() {
  const { state, saveReflection } = useApp();
  const [tab, setTab] = useState<Tab>('weekly');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [expandedPast, setExpandedPast] = useState<string | null>(null);

  const prompts = PROMPTS_MAP[tab];

  // Past reflections for this tab, newest first
  const pastReflections = state.reflections
    .filter(r => r.type === tab)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Check if today's reflection for this tab is already saved
  const todayEntry = pastReflections.find(r => r.date === TODAY);
  const [editingToday, setEditingToday] = useState(false);

  function save() {
    const hasContent = Object.values(answers).some(v => v.trim());
    if (!hasContent) {
      toast.error('Please fill in at least one prompt before saving.');
      return;
    }
    saveReflection({ type: tab, date: TODAY, answers });
    toast.success('Reflection saved ✨');
    setSaved(true);
    setEditingToday(false);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setSaved(false);
    setEditingToday(false);
    setAnswers({});
  }

  const showForm = !todayEntry || editingToday;

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">🌙 Reflections</div>
          <div className="topbar-sub">31 May 2026</div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          {(['weekly', 'monthly', 'quarterly'] as Tab[]).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>
              {TAB_LABELS[t]}
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

      {/* TODAY'S REFLECTION FORM or SAVED CARD */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <div className="px-4 space-y-4">
              {prompts.map(p => (
                <div key={p.key} className="prompt-block">
                  <div className="prompt-q">{p.q}</div>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    placeholder="Write freely..."
                    value={answers[p.key] || (editingToday && todayEntry ? todayEntry.answers[p.key] || '' : '')}
                    onChange={e => setAnswers(a => ({ ...a, [p.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="px-4 mt-4 flex gap-3">
              {editingToday && (
                <button onClick={() => setEditingToday(false)} className="flex-1 py-3.5 rounded-2xl font-semibold border border-[var(--border)] text-[var(--muted-foreground)]">
                  Cancel
                </button>
              )}
              <button
                onClick={save}
                className="flex-1 py-3.5 rounded-2xl text-white font-bold btn-sky"
              >
                Save {tab} reflection →
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="saved" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Collapsed "done" card */}
            <div className="mx-4 p-4 rounded-2xl bg-[var(--sky-mist)] border border-[var(--sky)]/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--sky)] flex items-center justify-center text-white text-lg shrink-0">✓</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--sky)]">{TAB_LABELS[tab]} reflection saved</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{getFirstAnswer(todayEntry!.answers)}</p>
              </div>
              <button
                onClick={() => { setEditingToday(true); setAnswers(todayEntry!.answers); }}
                className="text-xs text-[var(--sky)] font-semibold shrink-0"
              >
                Edit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAST ENTRIES */}
      {pastReflections.length > 0 && (
        <div className="mt-5">
          <div className="section-hdr">
            <div className="section-hdr-title">📖 Past {TAB_LABELS[tab].split(' ')[1]} Reflections</div>
          </div>
          <div className="px-4 space-y-2">
            {pastReflections.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                {/* Entry header — always visible */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setExpandedPast(expandedPast === r.id ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(r.date)}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{getFirstAnswer(r.answers)}</p>
                  </div>
                  <span className={`text-[var(--muted-foreground)] text-xs ml-2 transition-transform ${expandedPast === r.id ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {/* Expanded answers */}
                <AnimatePresence>
                  {expandedPast === r.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                        {PROMPTS_MAP[r.type].map(p => r.answers[p.key] ? (
                          <div key={p.key}>
                            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{p.q}</p>
                            <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{r.answers[p.key]}</p>
                          </div>
                        ) : null)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
