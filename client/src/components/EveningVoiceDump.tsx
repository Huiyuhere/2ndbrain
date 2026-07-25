/**
 * EveningVoiceDump — single mic button for the evening journal.
 *
 * Records one audio brain dump, sends it to voice.parseEveningDump,
 * shows a parsed preview (title, highlights, free write), and lets
 * the user confirm (apply to fields) or discard.
 */
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type ParsedDump = {
  title: string;
  highlights: Array<{ type: '+' | '-'; text: string }>;
  freeWrite: string;
};

type Props = {
  onApply: (parsed: ParsedDump) => void;
};

type State = 'idle' | 'recording' | 'uploading' | 'parsing' | 'preview';

export default function EveningVoiceDump({ onApply }: Props) {
  const [state, setState] = useState<State>('idle');
  const [parsed, setParsed] = useState<ParsedDump | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parseMutation = trpc.voice.parseEveningDump.useMutation();
  const resetMutation = useCallback(() => parseMutation.reset(), []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setState('recording');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast.error('Microphone access denied. Please allow microphone in your browser settings.');
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
    });

    setState('uploading');

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      // Upload audio
      const formData = new FormData();
      formData.append('audio', blob, 'evening-dump.webm');
      const uploadRes = await fetch('/api/voice/upload', { method: 'POST', body: formData, credentials: 'include' });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url: audioUrl } = await uploadRes.json() as { url: string };

      setState('parsing');

      // Parse with AI
      const result = await parseMutation.mutateAsync({ audioUrl });

      if (!result.title && result.highlights.length === 0 && !result.freeWrite) {
        toast.error("Couldn't pick up anything from the recording. Try again?");
        setState('idle');
        resetMutation();
        return;
      }

      setParsed({
        title: result.title,
        highlights: result.highlights as Array<{ type: '+' | '-'; text: string }>,
        freeWrite: result.freeWrite,
      });
      setState('preview');
    } catch (err) {
      console.error('[EveningVoiceDump]', err);
      toast.error('Something went wrong processing your voice note. Try again.');
      setState('idle');
      resetMutation();
    }
  }, [parseMutation, resetMutation]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('idle');
    setRecordingSeconds(0);
    resetMutation();
  }, [resetMutation]);

  const applyAndClose = useCallback(() => {
    if (!parsed) return;
    onApply(parsed);
    setParsed(null);
    setState('idle');
    resetMutation();
    toast.success('Applied to your evening journal!');
  }, [parsed, onApply, resetMutation]);

  const discard = useCallback(() => {
    setParsed(null);
    setState('idle');
    resetMutation();
  }, [resetMutation]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="mb-4">
      {/* Main trigger button */}
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            onClick={startRecording}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-[var(--sky)]/40 bg-[var(--sky-mist)] text-[var(--sky)] font-semibold flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
          >
            <span className="text-xl">🎙</span>
            <span>Dump it all — speak your day</span>
          </motion.button>
        )}

        {state === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600">Recording…</span>
                <span className="text-sm text-red-400 font-mono">{formatTime(recordingSeconds)}</span>
              </div>
              <button onClick={cancelRecording} className="text-xs text-red-400 font-medium">Cancel</button>
            </div>
            <p className="text-xs text-red-500 mb-3 leading-relaxed">
              Just talk — mention your wins, what didn't go well, how you feel. AI will sort it out.
            </p>
            <button
              onClick={stopAndProcess}
              className="w-full py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-[0.97] transition-transform"
            >
              Done — process my entry ✓
            </button>
          </motion.div>
        )}

        {(state === 'uploading' || state === 'parsing') && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full border-2 border-[var(--sky)] border-t-transparent animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {state === 'uploading' ? 'Uploading your voice note…' : 'AI is sorting your day…'}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {state === 'uploading' ? 'Almost there' : 'Classifying highlights, lessons & free thoughts'}
              </p>
            </div>
          </motion.div>
        )}

        {state === 'preview' && parsed && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border-2 border-[var(--sky)]/30 bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-[var(--sky-mist)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <span className="text-sm font-semibold text-[var(--sky)]">AI parsed your entry</span>
              </div>
              <button onClick={discard} className="text-xs text-[var(--muted-foreground)]">Discard</button>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Title */}
              {parsed.title && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Day title</p>
                  <p className="text-sm font-['Playfair_Display'] italic text-[var(--foreground)]">"{parsed.title}"</p>
                </div>
              )}

              {/* Highlights */}
              {parsed.highlights.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">Highlights & lessons</p>
                  <div className="space-y-1.5">
                    {parsed.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`shrink-0 w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center mt-0.5 ${
                          h.type === '+' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'
                        }`}>
                          {h.type}
                        </span>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{h.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free write */}
              {parsed.freeWrite && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Free write</p>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{parsed.freeWrite}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={discard}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--muted-foreground)]"
              >
                Discard
              </button>
              <button
                onClick={applyAndClose}
                className="flex-2 flex-grow py-2.5 rounded-xl btn-sky text-white text-sm font-bold"
              >
                Apply to journal ✓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
