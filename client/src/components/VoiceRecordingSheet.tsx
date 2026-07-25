/**
 * VoiceRecordingSheet
 *
 * A bottom sheet that appears while the user is recording audio.
 * Shows an animated waveform visualiser, elapsed timer, and Stop/Cancel buttons.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  isProcessing: boolean;
  onStop: () => void;
  onCancel: () => void;
  analyserNode: AnalyserNode | null;
}

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      const tick = () => {
        if (startRef.current !== null) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setElapsed(0);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const BAR_COUNT = 28;

function WaveformVisualiser({ analyserNode }: { analyserNode: AnalyserNode | null }) {
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.08));
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef(new Uint8Array(128));

  useEffect(() => {
    if (!analyserNode) {
      setBars(Array(BAR_COUNT).fill(0.08));
      return;
    }
    const draw = () => {
      analyserNode.getByteFrequencyData(dataRef.current);
      const step = Math.floor(dataRef.current.length / BAR_COUNT);
      const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
        const val = dataRef.current[i * step] ?? 0;
        return Math.max(0.06, val / 255);
      });
      setBars(newBars);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analyserNode]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-16 w-full">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="rounded-full bg-red-400"
          style={{ width: 3 }}
          animate={{ height: `${Math.round(h * 56)}px` }}
          transition={{ duration: 0.06, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

export default function VoiceRecordingSheet({ isOpen, isProcessing, onStop, onCancel, analyserNode }: Props) {
  const timer = useElapsedTimer(isOpen && !isProcessing);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isProcessing ? undefined : onCancel}
          />
          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-gray-600">Processing your voice…</p>
                <p className="text-xs text-gray-400">Transcribing + cleaning up filler words</p>
              </div>
            ) : (
              <>
                {/* Recording indicator */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-500 tracking-wide">Recording</span>
                  <span className="text-sm text-gray-400 font-mono ml-2">{timer}</span>
                </div>

                {/* Waveform */}
                <WaveformVisualiser analyserNode={analyserNode} />

                <p className="text-center text-xs text-gray-400 mt-2 mb-6">
                  Speak naturally — filler words will be removed automatically
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 active:scale-[0.97] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onStop}
                    className="flex-[2] py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                    Stop &amp; Process
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
