import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import {
  parseDurationInput,
  formatMinutes,
  getTaskMinutes,
  getTaskType,
} from '@/lib/store';

/**
 * Global modal that asks "How long did it take?" when a task is marked Done.
 * Reads `pendingCompletion` from AppContext; Save logs actualMinutes, Skip dismisses.
 */
export default function ActualTimeModal() {
  const { pendingCompletion, setPendingCompletion, logActualTime } = useApp();
  const [value, setValue] = useState('');

  const task = pendingCompletion;

  // Reset the input whenever a new task is queued
  useEffect(() => {
    setValue('');
  }, [task?.id]);

  const minutes = useMemo(() => parseDurationInput(value), [value]);
  const estMinutes = task ? getTaskMinutes(task) : 0;
  const tt = task ? getTaskType(task.taskType) : undefined;

  // Live preview of over/under estimate
  const diff = useMemo(() => {
    if (!task || estMinutes <= 0 || minutes <= 0) return null;
    const pct = Math.round(((minutes - estMinutes) / estMinutes) * 100);
    return pct;
  }, [task, estMinutes, minutes]);

  function close() {
    setPendingCompletion(null);
  }

  function save() {
    if (!task || minutes <= 0) return;
    logActualTime(task.id, minutes);
    setPendingCompletion(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  if (!task) return null;

  const QUICK = ['15m', '30m', '45m', '1h', '1.5h', '2h', '3h'];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
        <motion.div
          className="relative w-full sm:max-w-[420px] sm:mx-4 bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        >
          {/* Header */}
          <div
            className="px-6 pt-6 pb-5 rounded-t-3xl"
            style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}
          >
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4 sm:hidden" />
            <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-2">⏱ Task completed</p>
            <h2 className="text-white font-['Playfair_Display'] text-lg font-bold leading-snug">How long did it take?</h2>
            <p className="text-white/80 text-xs mt-1 truncate">{task.title}</p>
          </div>

          <div className="p-6">
            {/* Estimate context */}
            <div className="flex items-center gap-2 mb-3 text-xs text-[var(--muted-foreground)]">
              {tt && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white"
                  style={{ background: tt.color }}
                >
                  {tt.emoji} {tt.label}
                </span>
              )}
              <span>
                Estimated: <strong className="text-[var(--foreground)]">{estMinutes > 0 ? formatMinutes(estMinutes) : 'none'}</strong>
              </span>
            </div>

            {/* Input */}
            <input
              autoFocus
              className="w-full border-2 border-[var(--border)] rounded-xl px-4 py-3 text-base font-semibold text-[var(--foreground)] outline-none focus:border-[var(--sky)] transition-colors"
              placeholder="e.g. 3h, 45m, 1.5h, 90"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              inputMode="text"
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5">
              Type hours or minutes — “3h”, “45m”, “1h30m”, or a bare number for minutes.
            </p>

            {/* Quick picks */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {QUICK.map(q => (
                <button
                  key={q}
                  onClick={() => setValue(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.97] ${
                    value === q
                      ? 'border-transparent text-white btn-sky'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] bg-white hover:border-[var(--sky)]'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Live diff preview */}
            {diff !== null && (
              <div className="mt-4 p-3 rounded-xl bg-[var(--muted)] text-sm">
                {diff > 0 ? (
                  <p className="text-[var(--foreground)]">
                    🐢 Took <strong>{Math.abs(diff)}% longer</strong> than estimated — underestimated.
                  </p>
                ) : diff < 0 ? (
                  <p className="text-[var(--foreground)]">
                    🚀 Took <strong>{Math.abs(diff)}% less</strong> than estimated — overestimated.
                  </p>
                ) : (
                  <p className="text-[var(--foreground)]">🎯 Right on your estimate.</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={close}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-all active:scale-[0.97]"
              >
                Skip
              </button>
              <button
                onClick={save}
                disabled={minutes <= 0}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white btn-sky disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
              >
                Save{minutes > 0 ? ` · ${formatMinutes(minutes)}` : ''}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
