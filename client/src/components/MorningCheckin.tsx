import { useState } from 'react';
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

export default function MorningCheckin({ onClose }: { onClose: () => void }) {
  const { saveMoodEntry, markCheckinDone } = useApp();
  const [mood, setMood] = useState<number>(0);
  const [sleep, setSleep] = useState<number>(0);
  const [intention, setIntention] = useState('');
  const [focus, setFocus] = useState('');

  function handleSave() {
    if (!mood || !sleep) return;
    saveMoodEntry({ date: getTodayString(), mood, sleep, intention, focus });
    markCheckinDone();
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-[480px] bg-white rounded-t-3xl p-6 pb-10 shadow-2xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          {/* Header */}
          <div className="mb-5">
            <h2 className="font-[Playfair_Display] text-xl font-bold text-[var(--foreground)]">Good morning ☀️</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Sunday, 31 May 2026</p>
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
              className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--sky)] bg-[var(--sky-mist)]/30 font-[Playfair_Display] italic text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] placeholder:not-italic"
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
