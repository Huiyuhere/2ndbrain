import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getTodayString } from '@/lib/store';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function moodEmoji(mood: number) {
  const map: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '😊', 5: '😄' };
  return map[mood] ?? '😐';
}

export default function JournalViewer() {
  const { state, saveMoodEntry, saveEveningEntry } = useApp();
  const [tab, setTab] = useState<'morning' | 'evening'>('morning');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const morningEntries = [...(state.moodEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const eveningEntries = [...(state.eveningEntries || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="pb-8">
      <div className="topbar">
        <div>
          <div className="topbar-title">📖 Journal</div>
          <div className="topbar-sub">Morning &amp; evening entries</div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 rounded-xl text-white text-xs font-semibold btn-sky shadow-sm shrink-0"
        >
          + Backdate
        </button>
      </div>

      {/* TAB SWITCHER */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          <button className={`tab-btn ${tab === 'morning' ? 'active' : ''}`} onClick={() => setTab('morning')}>
            ☀️ Morning
          </button>
          <button className={`tab-btn ${tab === 'evening' ? 'active' : ''}`} onClick={() => setTab('evening')}>
            🌙 Evening
          </button>
        </div>
      </div>

      {/* MORNING ENTRIES */}
      {tab === 'morning' && (
        <div className="px-4 mt-4 space-y-3">
          {morningEntries.length === 0 && (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <p className="text-3xl mb-3">☀️</p>
              <p className="text-sm font-medium">No morning entries yet</p>
              <p className="text-xs mt-1">Tap “+ Backdate” above or complete your morning check-in on the Today page.</p>
            </div>
          )}
          {morningEntries.map(entry => {
            const isOpen = expandedId === `m-${entry.date}`;
            return (
              <div key={entry.date} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : `m-${entry.date}`)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg, #FFF3CD, #F0B429)' }}>
                    ☀️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(entry.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-[var(--muted-foreground)]">{moodEmoji(entry.mood)} Mood {entry.mood}/5</span>
                      <span className="text-xs text-[var(--muted-foreground)]">😴 {entry.sleep}h sleep</span>
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                    {entry.intention && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">🎯 Today's Intention</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{entry.intention}</p>
                      </div>
                    )}
                    {entry.focus && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">🔍 Focus</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{entry.focus}</p>
                      </div>
                    )}
                    {!entry.intention && !entry.focus && (
                      <p className="text-sm text-[var(--muted-foreground)] italic">No details recorded.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EVENING ENTRIES */}
      {tab === 'evening' && (
        <div className="px-4 mt-4 space-y-3">
          {eveningEntries.length === 0 && (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <p className="text-3xl mb-3">🌙</p>
              <p className="text-sm font-medium">No evening entries yet</p>
              <p className="text-xs mt-1">Tap “+ Backdate” above or complete your evening review on the Today page.</p>
            </div>
          )}
          {eveningEntries.map(entry => {
            const isOpen = expandedId === `e-${entry.date}`;
            const wins = entry.highlights.filter(h => h.type === '+');
            const lows = entry.highlights.filter(h => h.type === '-');
            return (
              <div key={entry.date} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : `e-${entry.date}`)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg, #E8D5F5, #6B5EA8)' }}>
                    🌙
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(entry.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-[var(--muted-foreground)]">{['😔','😕','😐','😊','😄'][(entry.moodScore ?? 3) - 1]} Mood {entry.moodScore ?? 3}/5</span>
                      <span className="text-xs text-[var(--muted-foreground)]">⭐ {entry.rating}/10</span>
                      {entry.title && <span className="text-xs text-[var(--muted-foreground)] truncate">{entry.title}</span>}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                    {entry.location && (
                      <p className="text-xs text-[var(--muted-foreground)]">📍 {entry.location}</p>
                    )}
                    {wins.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">🏆 Highlights</p>
                        <ul className="space-y-1">
                          {wins.map((h, i) => (
                            <li key={i} className="text-sm text-[var(--foreground)] flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">+</span>
                              {h.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lows.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">📈 Improvements</p>
                        <ul className="space-y-1">
                          {lows.map((h, i) => (
                            <li key={i} className="text-sm text-[var(--foreground)] flex items-start gap-2">
                              <span className="text-orange-400 mt-0.5">−</span>
                              {h.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.freeWrite && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">📝 Free Write</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">{entry.freeWrite}</p>
                      </div>
                    )}
                    {entry.photoUrl && (
                      <img src={entry.photoUrl} alt="Day photo" className="w-full rounded-xl object-cover max-h-48" />
                    )}
                    {!wins.length && !lows.length && !entry.freeWrite && (
                      <p className="text-sm text-[var(--muted-foreground)] italic">No details recorded.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <BackdateModal
          initialKind={tab}
          onClose={() => setShowAddModal(false)}
          existingMood={state.moodEntries}
          existingEvening={state.eveningEntries}
          onSaveMorning={saveMoodEntry}
          onSaveEvening={saveEveningEntry}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Backdate modal
// ────────────────────────────────────────────────────────────────────────────

type MoodE = ReturnType<typeof useApp>['state']['moodEntries'][number];
type EveningE = ReturnType<typeof useApp>['state']['eveningEntries'][number];

function BackdateModal({
  initialKind,
  onClose,
  existingMood,
  existingEvening,
  onSaveMorning,
  onSaveEvening,
}: {
  initialKind: 'morning' | 'evening';
  onClose: () => void;
  existingMood: MoodE[];
  existingEvening: EveningE[];
  onSaveMorning: (e: MoodE) => void;
  onSaveEvening: (e: EveningE) => void;
}) {
  const today = getTodayString();
  const [kind, setKind] = useState<'morning' | 'evening'>(initialKind);
  const [date, setDate] = useState(today);

  // load existing for chosen date
  const existingM = useMemo(() => existingMood.find(e => e.date === date), [existingMood, date]);
  const existingE = useMemo(() => existingEvening.find(e => e.date === date), [existingEvening, date]);

  // morning state
  const [mood, setMood] = useState(existingM?.mood ?? 3);
  const [sleep, setSleep] = useState(existingM?.sleep ?? 7);
  const [intention, setIntention] = useState(existingM?.intention ?? '');
  const [focus, setFocus] = useState(existingM?.focus ?? '');

  // evening state
  const [location, setLocation] = useState(existingE?.location ?? 'Singapore');
  const [title, setTitle] = useState(existingE?.title ?? '');
  const [rating, setRating] = useState(existingE?.rating ?? 0);
  const [eveningMood, setEveningMood] = useState(existingE?.moodScore ?? 3);
  const [highlights, setHighlights] = useState<{ type: '+' | '-'; text: string }[]>(
    existingE?.highlights ?? [{ type: '+', text: '' }, { type: '+', text: '' }, { type: '-', text: '' }]
  );
  const [freeWrite, setFreeWrite] = useState(existingE?.freeWrite ?? '');

  // refresh fields when date / kind changes
  useEffect(() => {
    setMood(existingM?.mood ?? 3);
    setSleep(existingM?.sleep ?? 7);
    setIntention(existingM?.intention ?? '');
    setFocus(existingM?.focus ?? '');
  }, [existingM]);
  useEffect(() => {
    setLocation(existingE?.location ?? 'Singapore');
    setTitle(existingE?.title ?? '');
    setRating(existingE?.rating ?? 0);
    setEveningMood(existingE?.moodScore ?? 3);
    setHighlights(
      existingE?.highlights ?? [
        { type: '+', text: '' },
        { type: '+', text: '' },
        { type: '-', text: '' },
      ]
    );
    setFreeWrite(existingE?.freeWrite ?? '');
  }, [existingE]);

  function handleSave() {
    if (kind === 'morning') {
      onSaveMorning({ date, mood, sleep, intention, focus });
    } else {
      onSaveEvening({
        date,
        location,
        title,
        rating,
        moodScore: eveningMood,
        highlights: highlights.filter(h => h.text),
        freeWrite,
      });
    }
    onClose();
  }

  const hasExisting = kind === 'morning' ? !!existingM : !!existingE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-base font-bold">Backdate journal entry</p>
            <p className="text-xs text-[var(--muted-foreground)]">{formatDate(date)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date input */}
          <div>
            <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Date</label>
            <input
              type="date"
              className="input-field mt-1"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
            />
            {hasExisting && (
              <p className="text-xs text-amber-600 mt-1">
                An entry already exists for this date — saving will overwrite it.
              </p>
            )}
          </div>

          {/* Kind switcher */}
          <div className="tab-switcher">
            <button className={`tab-btn ${kind === 'morning' ? 'active' : ''}`} onClick={() => setKind('morning')}>
              ☀️ Morning
            </button>
            <button className={`tab-btn ${kind === 'evening' ? 'active' : ''}`} onClick={() => setKind('evening')}>
              🌙 Evening
            </button>
          </div>

          {kind === 'morning' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Mood</label>
                <div className="flex gap-2 mt-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setMood(n)}
                      className={`flex-1 h-11 rounded-xl text-xl border-2 transition-all ${
                        mood === n
                          ? 'border-transparent text-white btn-sky'
                          : 'border-[var(--border)] bg-white'
                      }`}
                    >
                      {moodEmoji(n)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Sleep (hours)</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  className="input-field mt-1"
                  value={sleep}
                  onChange={e => setSleep(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Intention</label>
                <input
                  className="input-field mt-1 font-['Playfair_Display'] italic"
                  placeholder="What was the day for?"
                  value={intention}
                  onChange={e => setIntention(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">#1 focus task</label>
                <input
                  className="input-field mt-1"
                  placeholder="The single most important thing..."
                  value={focus}
                  onChange={e => setFocus(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Location</label>
                <input
                  className="input-field mt-1"
                  placeholder="Singapore"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Title or quote</label>
                <input
                  className="input-field mt-1 font-['Playfair_Display'] italic"
                  placeholder="有光的地方 ♥"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Evening mood</label>
                <div className="flex gap-2 mt-1.5">
                  {(['😔','😕','😐','😊','😄'] as const).map((emoji, idx) => {
                    const val = idx + 1;
                    return (
                      <button
                        key={val}
                        onClick={() => setEveningMood(val)}
                        className={`flex-1 h-11 rounded-xl text-xl border-2 transition-all ${
                          eveningMood === val
                            ? 'border-transparent btn-sky'
                            : 'border-[var(--border)] bg-white'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Day rating (1–10)</label>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold border-2 transition-all ${
                        rating === n
                          ? 'border-transparent text-white btn-sky'
                          : 'border-[var(--border)] text-[var(--muted-foreground)] bg-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Highlights & lessons</label>
                <div className="space-y-2 mt-1.5">
                  {highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setHighlights(hs => hs.map((x, j) => (j === i ? { ...x, type: x.type === '+' ? '-' : '+' } : x)))
                        }
                        className={`w-7 h-7 rounded-lg text-sm font-bold shrink-0 transition-all ${
                          h.type === '+'
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-red-50 text-red-500 border border-red-200'
                        }`}
                      >
                        {h.type}
                      </button>
                      <input
                        className="input-field flex-1"
                        placeholder={h.type === '+' ? 'Something good...' : "What didn't go well..."}
                        value={h.text}
                        onChange={e =>
                          setHighlights(hs => hs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                        }
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setHighlights(hs => [...hs, { type: '+', text: '' }])}
                    className="text-xs text-[var(--sky)] font-medium"
                  >
                    + Add line
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Free write</label>
                <textarea
                  className="input-field mt-1 min-h-[80px] resize-none"
                  placeholder="Anything else on your mind..."
                  value={freeWrite}
                  onChange={e => setFreeWrite(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky"
          >
            {hasExisting ? `Update ${formatDate(date)}` : `Save ${formatDate(date)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
