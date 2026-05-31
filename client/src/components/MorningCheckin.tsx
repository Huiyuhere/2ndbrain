import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getTodayString } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

const MOODS = [
  { score: 1, emoji: '😴', label: 'Drained' },
  { score: 2, emoji: '😐', label: 'Low' },
  { score: 3, emoji: '🙂', label: 'Neutral' },
  { score: 4, emoji: '😊', label: 'Good' },
  { score: 5, emoji: '🔥', label: 'Energised' },
];

const SLEEP_OPTIONS = [4, 5, 6, 7, 8, 9];

const DAILY_QUOTES = [
  { text: 'The empire you build today is the freedom you live tomorrow.', author: 'Unknown' },
  { text: 'You don\'t rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Do the hard thing first. The rest of the day is a gift.', author: 'Unknown' },
  { text: 'Every morning is a chance to rewrite the story.', author: 'Unknown' },
  { text: 'Small consistent actions compound into extraordinary results.', author: 'Unknown' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'The most important investment you can make is in yourself.', author: 'Warren Buffett' },
  { text: 'One brick at a time. One day at a time. That\'s how empires are built.', author: 'Unknown' },
  { text: 'Your future self is watching you right now through your memories.', author: 'Unknown' },
  { text: 'Be so good they can\'t ignore you.', author: 'Steve Martin' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Clarity comes from action, not thought.', author: 'Unknown' },
  { text: 'Build something you\'d be proud to show the world.', author: 'Unknown' },
  { text: 'The grind is the gift. Most people quit before the compound interest kicks in.', author: 'Unknown' },
  { text: 'Energy flows where attention goes.', author: 'Unknown' },
  { text: 'You are one decision away from a completely different life.', author: 'Unknown' },
  { text: 'Make it happen. Shock everyone.', author: 'Unknown' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Momentum is built one morning at a time.', author: 'Unknown' },
  { text: 'Your vision is your compass. Keep it close.', author: 'Unknown' },
  { text: 'Work like someone is always trying to take your spot.', author: 'Unknown' },
  { text: 'The ocean doesn\'t apologise for its depth. Neither should you.', author: 'Unknown' },
  { text: 'Dream big. Start small. Act now.', author: 'Robin Sharma' },
  { text: 'Consistency beats intensity every single time.', author: 'Unknown' },
  { text: 'You don\'t need more time. You need more focus.', author: 'Unknown' },
  { text: 'The version of you that succeeds is already inside you.', author: 'Unknown' },
  { text: 'Every expert was once a beginner who refused to quit.', author: 'Unknown' },
  { text: 'Your only competition is who you were yesterday.', author: 'Unknown' },
  { text: 'Build the life you\'d be jealous of.', author: 'Unknown' },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

function formatTodayLong() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MorningCheckin({ onClose }: { onClose: () => void }) {
  const { saveMoodEntry, markCheckinDone, state } = useApp();
  const [mood, setMood] = useState<number>(0);
  const [sleep, setSleep] = useState<number>(0);
  const [intention, setIntention] = useState('');
  const [focus, setFocus] = useState('');

  const quote = getDailyQuote();
  const today = getTodayString();

  // If already checked in today (on any device), close immediately
  useEffect(() => {
    if (state.moodEntries.some(e => e.date === today)) {
      onClose();
    }
  }, [state.moodEntries, today, onClose]);

  function handleSave() {
    if (!mood || !sleep) return;
    saveMoodEntry({ date: today, mood, sleep, intention, focus });
    markCheckinDone();
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full sm:max-w-[480px] sm:mx-4 bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: 'calc(100dvh - 20px)' }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Quote banner — fixed at top, never scrolls away */}
          <div className="px-6 pt-6 pb-5 shrink-0 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
            {/* Drag handle on mobile */}
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4 sm:hidden" />
            <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-2">✨ Today's reminder</p>
            <p className="text-white font-['Playfair_Display'] italic text-sm leading-relaxed">"{quote.text}"</p>
            {quote.author !== 'Unknown' && (
              <p className="text-white/50 text-[10px] mt-1.5">— {quote.author}</p>
            )}
          </div>

          {/* Scrollable content area */}
          <div className="overflow-y-auto flex-1 p-6 pb-8">
            {/* Header */}
            <div className="mb-5">
              <h2 className="font-[Playfair_Display] text-xl font-bold text-[var(--foreground)]">Good morning ☀️</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{formatTodayLong()}</p>
            </div>

            {/* Sleep */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-[var(--foreground)] mb-2">😴 How did you sleep?</p>
              <div className="flex gap-2 flex-wrap">
                {SLEEP_OPTIONS.map(h => (
                  <button
                    key={h}
                    onClick={() => setSleep(h)}
                    className={`w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all ${
                      sleep === h
                        ? 'border-transparent text-white btn-sky'
                        : 'border-[var(--border)] text-[var(--muted-foreground)] bg-white hover:border-[var(--sky-light)]'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
                <button
                  onClick={() => setSleep(10)}
                  className={`px-3 h-11 rounded-xl text-sm font-bold border-2 transition-all ${
                    sleep === 10
                      ? 'border-transparent text-white btn-sky'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] bg-white'
                  }`}
                >
                  9+h
                </button>
              </div>
            </div>

            {/* Mood */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-[var(--foreground)] mb-2">⚡ How's your energy?</p>
              <div className="flex gap-2">
                {MOODS.map(m => (
                  <button
                    key={m.score}
                    onClick={() => setMood(m.score)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${
                      mood === m.score
                        ? 'border-[var(--sky)] bg-[var(--sky-mist)]'
                        : 'border-[var(--border)] bg-white'
                    }`}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-[9px] font-semibold text-[var(--muted-foreground)]">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Intention */}
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--foreground)] mb-2">☀️ Today's intention</p>
              <input
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--sky)] bg-[var(--sky-mist)]/30 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                placeholder="What am I here to do today?"
                value={intention}
                onChange={e => setIntention(e.target.value)}
              />
            </div>

            {/* Focus */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-[var(--foreground)] mb-2">🎯 #1 focus task</p>
              <input
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--sky)]"
                placeholder="The single most important thing..."
                value={focus}
                onChange={e => setFocus(e.target.value)}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!mood || !sleep}
              className="w-full py-4 rounded-2xl text-white font-bold text-base btn-sky disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Let's go →
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
