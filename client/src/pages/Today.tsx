import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getTodayString, getTodayLabel } from '@/lib/store';
import UserAvatar from '@/components/UserAvatar';
import TaskCard from '@/components/TaskCard';
import GoalBanner from '@/components/GoalBanner';
import QuoteBanner from '@/components/QuoteBanner';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceMicButton from '@/components/VoiceMicButton';

// Compute YYYY-MM-DD for a given offset back from today (in local TZ)
function dateStringForOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prettyDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Today() {
  const { state, toggleHabit, saveMoodEntry, saveEveningEntry } = useApp();
  const today = getTodayString();
  const todayTasks = state.tasks.filter(t => t.column === 'today');
  const doneTasks = state.tasks.filter(t => t.column === 'done' && t.completedAt === today);
  const [journalTab, setJournalTab] = useState<'morning' | 'evening'>('morning');

  // Date selector for journal backfill (today, yesterday, 2 days ago)
  const datePills = useMemo(
    () => [
      { offset: 0, label: 'Today', date: dateStringForOffset(0) },
      { offset: 1, label: 'Yesterday', date: dateStringForOffset(1) },
      { offset: 2, label: '2 days ago', date: dateStringForOffset(2) },
    ],
    []
  );
  const [selectedDate, setSelectedDate] = useState(today);

  // Morning — re-bound to selectedDate
  const existingMood = state.moodEntries.find(e => e.date === selectedDate);
  const [intention, setIntention] = useState(existingMood?.intention || '');
  const [focus, setFocus] = useState(existingMood?.focus || '');

  // Evening — re-bound to selectedDate
  const existingEvening = state.eveningEntries.find(e => e.date === selectedDate);
  const [location, setLocation] = useState(existingEvening?.location || 'Singapore');
  const [dayTitle, setDayTitle] = useState(existingEvening?.title || '');
  const [rating, setRating] = useState(existingEvening?.rating || 0);
  const [eveningMood, setEveningMood] = useState(existingEvening?.moodScore || 3);
  const [highlights, setHighlights] = useState<{ type: '+' | '-'; text: string }[]>(
    existingEvening?.highlights || [{ type: '+', text: '' }, { type: '+', text: '' }, { type: '-', text: '' }]
  );
  const [freeWrite, setFreeWrite] = useState(existingEvening?.freeWrite || '');
  const [morningSaved, setMorningSaved] = useState(!!existingMood);
  const [eveningSaved, setEveningSaved] = useState(!!existingEvening);

  // Track if the user has unsaved changes vs. what's stored for selectedDate
  const morningDirty =
    !morningSaved &&
    (intention !== (existingMood?.intention || '') || focus !== (existingMood?.focus || ''));
  const eveningDirty =
    !eveningSaved &&
    (location !== (existingEvening?.location || 'Singapore') ||
      dayTitle !== (existingEvening?.title || '') ||
      rating !== (existingEvening?.rating || 0) ||
      freeWrite !== (existingEvening?.freeWrite || '') ||
      JSON.stringify(highlights) !==
        JSON.stringify(
          existingEvening?.highlights || [
            { type: '+', text: '' },
            { type: '+', text: '' },
            { type: '-', text: '' },
          ]
        ));

  // When selectedDate changes (or upstream entries refresh), refresh form fields
  useEffect(() => {
    const m = state.moodEntries.find(e => e.date === selectedDate);
    setIntention(m?.intention || '');
    setFocus(m?.focus || '');
    setMorningSaved(!!m);

    const ev = state.eveningEntries.find(e => e.date === selectedDate);
    setLocation(ev?.location || 'Singapore');
    setDayTitle(ev?.title || '');
    setRating(ev?.rating || 0);
    setEveningMood(ev?.moodScore || 3);
    setHighlights(
      ev?.highlights || [
        { type: '+', text: '' },
        { type: '+', text: '' },
        { type: '-', text: '' },
      ]
    );
    setFreeWrite(ev?.freeWrite || '');
    setEveningSaved(!!ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, state.moodEntries, state.eveningEntries]);

  function handlePillClick(targetDate: string) {
    if (targetDate === selectedDate) return;
    if (morningDirty || eveningDirty) {
      const ok = window.confirm(
        'You have unsaved changes for ' +
          prettyDateLabel(selectedDate) +
          '. Switch dates and discard them?'
      );
      if (!ok) return;
    }
    setSelectedDate(targetDate);
  }

  function saveMorning() {
    saveMoodEntry({
      date: selectedDate,
      mood: existingMood?.mood || 3,
      sleep: existingMood?.sleep || 7,
      intention,
      focus,
    });
    setMorningSaved(true);
  }

  function saveEvening() {
    saveEveningEntry({
      date: selectedDate,
      location,
      title: dayTitle,
      rating,
      moodScore: eveningMood,
      highlights: highlights.filter(h => h.text),
      freeWrite,
    });
    setEveningSaved(true);
  }

  const isToday = selectedDate === today;
  const todayMood = state.moodEntries.find(e => e.date === today);

  return (
    <div className="pb-4">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">⚡ Today</div>
          <div className="topbar-sub">{getTodayLabel()}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="streak-badge">🔥 {state.streak}</span>
          <UserAvatar size={36} />
        </div>
      </div>

      {/* QUOTE OF THE DAY */}
      <QuoteBanner />

      {/* FOCUS BANNER — always tied to today's mood entry */}
      <GoalBanner compact focusOverride={todayMood?.focus || undefined} />

      {/* HABIT STRIP */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">🔥 Today's Habits</div>
        <a href="/habits" className="section-hdr-action">See all</a>
      </div>
      <div className="flex gap-3 px-4 overflow-x-auto pb-2">
        {state.habits.map(h => {
          const done = h.completedDates.includes(today);
          return (
            <div key={h.id} className="flex flex-col items-center gap-1.5 shrink-0">
              <button
                onClick={() => toggleHabit(h.id, today)}
                className={`habit-dot ${done ? 'done' : ''}`}
              >
                {h.emoji}
              </button>
              <span className="text-[10px] text-[var(--muted-foreground)] text-center max-w-[44px] leading-tight">{h.name.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* TODAY'S TASKS */}
      <div className="section-hdr mt-2">
        <div className="section-hdr-title">📋 Today's Tasks <span className="text-[var(--muted-foreground)] font-normal">({doneTasks.length}/{todayTasks.length + doneTasks.length})</span></div>
        <span className="section-hdr-action">+ Add</span>
      </div>
      <div className="px-4 space-y-0">
        {todayTasks.map(t => <TaskCard key={t.id} task={t} showBorder />)}
        {doneTasks.map(t => <TaskCard key={t.id} task={t} />)}
        {todayTasks.length === 0 && doneTasks.length === 0 && (
          <div className="text-center py-8 text-[var(--muted-foreground)] text-sm">
            <p className="text-2xl mb-2">⚡</p>
            <p>No tasks for today yet.</p>
            <p className="text-xs mt-1">Move tasks from the Board or add new ones.</p>
          </div>
        )}
      </div>

      {/* JOURNAL */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">📖 Journal</div>
      </div>
      <div className="px-4">
        {/* DATE BACKFILL PILLS */}
        <div className="flex gap-2 mb-3">
          {datePills.map(p => {
            const active = p.date === selectedDate;
            const hasEntry =
              state.moodEntries.some(e => e.date === p.date) ||
              state.eveningEntries.some(e => e.date === p.date);
            return (
              <button
                key={p.offset}
                onClick={() => handlePillClick(p.date)}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                  active
                    ? 'border-transparent text-white btn-sky'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] bg-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{p.label}</span>
                  {hasEntry && <span className={active ? 'opacity-90' : 'text-green-500'}>•</span>}
                </div>
              </button>
            );
          })}
        </div>

        {!isToday && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Backfilling <strong>{prettyDateLabel(selectedDate)}</strong>. Streaks &amp; the morning check-in only apply to today.
          </div>
        )}

        <div className="tab-switcher">
          <button className={`tab-btn ${journalTab === 'morning' ? 'active' : ''}`} onClick={() => setJournalTab('morning')}>☀️ Morning</button>
          <button className={`tab-btn ${journalTab === 'evening' ? 'active' : ''}`} onClick={() => setJournalTab('evening')}>🌙 Evening</button>
        </div>

        <AnimatePresence mode="wait">
          {journalTab === 'morning' ? (
            <motion.div key="morning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {morningSaved ? (
                <div className="bg-[var(--sky-mist)] rounded-2xl p-4 text-center">
                  <p className="text-2xl mb-1">☀️</p>
                  <p className="text-sm font-semibold text-[var(--sky)]">Morning entry saved</p>
                  {intention && <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">"{intention}"</p>}
                  <button onClick={() => setMorningSaved(false)} className="text-xs text-[var(--sky)] mt-2 font-medium">Edit</button>
                </div>
              ) : (
                <>
                  <div className="prompt-block">
                    <div className="prompt-q flex items-center justify-between">
                      <span>☀️ {isToday ? "Today's intention" : `Intention for ${prettyDateLabel(selectedDate)}`}</span>
                      <VoiceMicButton fieldHint="morning intention" onTranscript={t => setIntention(prev => prev ? prev + ' ' + t : t)} />
                    </div>
                    <input
                      className="input-field font-['Playfair_Display'] italic"
                      placeholder="What am I here to do today?"
                      value={intention}
                      onChange={e => setIntention(e.target.value)}
                    />
                  </div>
                  <div className="prompt-block">
                    <div className="prompt-q flex items-center justify-between">
                      <span>🎯 #1 focus task</span>
                      <VoiceMicButton fieldHint="number one focus task for today" onTranscript={t => setFocus(prev => prev ? prev + ' ' + t : t)} />
                    </div>
                    <input
                      className="input-field"
                      placeholder="The single most important thing..."
                      value={focus}
                      onChange={e => setFocus(e.target.value)}
                    />
                  </div>
                  <button onClick={saveMorning} className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky">
                    {isToday ? "Let's go →" : `Save for ${prettyDateLabel(selectedDate)} →`}
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="evening" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {eveningSaved ? (
                <div className="bg-[var(--sky-mist)] rounded-2xl p-4 text-center">
                  <p className="text-2xl mb-1">🌙</p>
                  <p className="text-sm font-semibold text-[var(--sky)]">Evening entry saved — {['😔','😕','😐','😊','😄'][eveningMood-1]}</p>
                  {dayTitle && <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">"{dayTitle}"</p>}
                  <button onClick={() => setEveningSaved(false)} className="text-xs text-[var(--sky)] mt-2 font-medium">Edit</button>
                </div>
              ) : (
                <>
                  {/* Photo + location */}
                  <div className="flex gap-3 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-[var(--muted)] border-2 border-dashed border-[var(--border)] flex items-center justify-center text-2xl cursor-pointer shrink-0">📷</div>
                    <div className="flex-1">
                      <div className="prompt-q">📍 Location</div>
                      <input className="input-field" placeholder="Singapore" value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                  </div>

                  <div className="prompt-block">
                    <div className="prompt-q flex items-center justify-between">
                      <span>{isToday ? "Today's title or quote" : `Title or quote for ${prettyDateLabel(selectedDate)}`}</span>
                      <VoiceMicButton fieldHint="day title or quote" onTranscript={t => setDayTitle(prev => prev ? prev + ' ' + t : t)} />
                    </div>
                    <input className="input-field font-['Playfair_Display'] italic" placeholder="有光的地方 ♥" value={dayTitle} onChange={e => setDayTitle(e.target.value)} />
                  </div>

                  <div className="prompt-block">
                    <div className="prompt-q">Evening mood</div>
                    <div className="flex gap-2 mt-1">
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
                  <div className="prompt-block">
                    <div className="prompt-q">Day rating (1–10)</div>
                    <div className="flex gap-1.5 flex-wrap">
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

                  <div className="prompt-block">
                    <div className="prompt-q">Highlights & lessons</div>
                    <div className="space-y-2">
                      {highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() => setHighlights(hs => hs.map((x, j) => j === i ? { ...x, type: x.type === '+' ? '-' : '+' } : x))}
                            className={`w-7 h-7 rounded-lg text-sm font-bold shrink-0 transition-all ${h.type === '+' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'}`}
                          >
                            {h.type}
                          </button>
                          <input
                            className="input-field flex-1"
                            placeholder={h.type === '+' ? 'Something good today...' : "What didn't go well..."}
                            value={h.text}
                            onChange={e => setHighlights(hs => hs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                          />
                          <VoiceMicButton
                            fieldHint={h.type === '+' ? 'highlight or win from today' : 'lesson or thing that did not go well'}
                            onTranscript={t => setHighlights(hs => hs.map((x, j) => j === i ? { ...x, text: x.text ? x.text + ' ' + t : t } : x))}
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

                  <div className="prompt-block">
                    <div className="prompt-q flex items-center justify-between">
                      <span>Free write (optional)</span>
                      <VoiceMicButton fieldHint="free write journal entry, anything on your mind" onTranscript={t => setFreeWrite(prev => prev ? prev + '\n\n' + t : t)} />
                    </div>
                    <textarea className="input-field min-h-[80px] resize-none" placeholder="Anything else on your mind..." value={freeWrite} onChange={e => setFreeWrite(e.target.value)} />
                  </div>

                  <button onClick={saveEvening} className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky mb-2">
                    {isToday ? 'Save evening entry 🌙' : `Save for ${prettyDateLabel(selectedDate)} 🌙`}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
