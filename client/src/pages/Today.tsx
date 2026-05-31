import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getTodayString } from '@/lib/store';
import TaskCard from '@/components/TaskCard';
import GoalBanner from '@/components/GoalBanner';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekDays() {
  const today = new Date(2026, 4, 31); // May 31 2026
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return d;
  });
}

export default function Today() {
  const { state, toggleHabit, saveMoodEntry, saveEveningEntry } = useApp();
  const today = getTodayString();
  const todayTasks = state.tasks.filter(t => t.column === 'today');
  const doneTasks = state.tasks.filter(t => t.column === 'done' && t.completedAt === today);
  const weekDays = getWeekDays();
  const [journalTab, setJournalTab] = useState<'morning' | 'evening'>('morning');

  // Morning
  const existingMood = state.moodEntries.find(e => e.date === today);
  const [intention, setIntention] = useState(existingMood?.intention || '');
  const [focus, setFocus] = useState(existingMood?.focus || '');

  // Evening
  const existingEvening = state.eveningEntries.find(e => e.date === today);
  const [location, setLocation] = useState(existingEvening?.location || 'Singapore');
  const [dayTitle, setDayTitle] = useState(existingEvening?.title || '');
  const [rating, setRating] = useState(existingEvening?.rating || 0);
  const [highlights, setHighlights] = useState<{ type: '+' | '-'; text: string }[]>(
    existingEvening?.highlights || [{ type: '+', text: '' }, { type: '+', text: '' }, { type: '-', text: '' }]
  );
  const [freeWrite, setFreeWrite] = useState(existingEvening?.freeWrite || '');
  const [morningSaved, setMorningSaved] = useState(!!existingMood);
  const [eveningSaved, setEveningSaved] = useState(!!existingEvening);

  function saveMorning() {
    saveMoodEntry({ date: today, mood: existingMood?.mood || 3, sleep: existingMood?.sleep || 7, intention, focus });
    setMorningSaved(true);
  }

  function saveEvening() {
    saveEveningEntry({ date: today, location, title: dayTitle, rating, highlights: highlights.filter(h => h.text), freeWrite });
    setEveningSaved(true);
  }

  return (
    <div className="pb-4">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">⚡ Today</div>
          <div className="topbar-sub">Sunday, 31 May 2026</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="streak-badge">🔥 {state.streak}</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>TH</div>
        </div>
      </div>

      {/* GOAL BANNER */}
      <GoalBanner compact />

      {/* WEEK STRIP */}
      <div className="flex gap-1.5 px-4 mt-4 overflow-x-auto pb-1">
        {weekDays.map((d, i) => {
          const isToday = d.getDate() === 31 && d.getMonth() === 4;
          return (
            <div key={i} className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl min-w-[44px] cursor-pointer transition-all ${
              isToday ? 'bg-[var(--sky)] text-white shadow-md' : 'bg-white border border-[var(--border)] text-[var(--muted-foreground)]'
            }`}>
              <span className="text-[10px] font-semibold">{DAYS[d.getDay()]}</span>
              <span className="text-sm font-bold">{d.getDate()}</span>
            </div>
          );
        })}
      </div>

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
                    <div className="prompt-q">☀️ Today's intention</div>
                    <input
                      className="input-field font-['Playfair_Display'] italic"
                      placeholder="What am I here to do today?"
                      value={intention}
                      onChange={e => setIntention(e.target.value)}
                    />
                  </div>
                  <div className="prompt-block">
                    <div className="prompt-q">🎯 Today's #1 focus task</div>
                    <input
                      className="input-field"
                      placeholder="The single most important thing..."
                      value={focus}
                      onChange={e => setFocus(e.target.value)}
                    />
                  </div>
                  <button onClick={saveMorning} className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky">Let's go →</button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="evening" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {eveningSaved ? (
                <div className="bg-[var(--sky-mist)] rounded-2xl p-4 text-center">
                  <p className="text-2xl mb-1">🌙</p>
                  <p className="text-sm font-semibold text-[var(--sky)]">Evening entry saved — {rating}/10</p>
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
                    <div className="prompt-q">Today's title or quote</div>
                    <input className="input-field font-['Playfair_Display'] italic" placeholder="有光的地方 ♥" value={dayTitle} onChange={e => setDayTitle(e.target.value)} />
                  </div>

                  <div className="prompt-block">
                    <div className="prompt-q">Day rating</div>
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
                    <div className="prompt-q">Free write (optional)</div>
                    <textarea className="input-field min-h-[80px] resize-none" placeholder="Anything else on your mind..." value={freeWrite} onChange={e => setFreeWrite(e.target.value)} />
                  </div>

                  <button onClick={saveEvening} className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky mb-2">Save evening entry 🌙</button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
