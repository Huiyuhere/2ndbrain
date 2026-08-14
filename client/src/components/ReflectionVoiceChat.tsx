/**
 * ReflectionVoiceChat — conversational voice journaling for reflections.
 *
 * Works like the Evening "Chat about your day" but adapted for reflection prompts.
 * The friend asks each prompt in a warm conversational tone, allows follow-ups,
 * then distributes the combined transcript into the correct prompt fields.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type Prompt = { q: string; key: string };
type ConvoStep = { role: 'friend' | 'you'; text: string };
type FlowState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'follow-up' | 'wrapping' | 'preview';

type Props = {
  prompts: Prompt[];
  onApply: (answers: Record<string, string>) => void;
  /** Externally managed state for session persistence */
  chatState?: ChatState;
  onChatStateChange?: (state: ChatState | null) => void;
};

export type ChatState = {
  flowState: FlowState;
  convo: ConvoStep[];
  transcriptParts: string[];
  promptIdx: number;
  parsedAnswers: Record<string, string> | null;
};

function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function getExtForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

/** Convert a prompt question into a warm conversational version */
function warmify(q: string, isFirst: boolean): string {
  // Strip emoji prefix
  const clean = q.replace(/^[^\w]+/, '').trim();
  if (isFirst) {
    return `Let's start — ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
  }
  const openers = [
    'Okay, next one —',
    'Love it! Now,',
    'Great, moving on —',
    'Alright,',
    'Nice! Now tell me,',
  ];
  const opener = openers[Math.floor(Math.random() * openers.length)];
  return `${opener} ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

const FOLLOW_UPS = [
  "Tell me more about that.",
  "Interesting — anything else on this one?",
  "I hear you. Want to add anything?",
  "Got it! Anything else before we move on?",
  "Mmm, that's real. Anything to add?",
];

export default function ReflectionVoiceChat({ prompts, onApply, chatState, onChatStateChange }: Props) {
  // Use external state if provided (for session persistence), otherwise local
  const [localFlowState, setLocalFlowState] = useState<FlowState>(chatState?.flowState ?? 'idle');
  const [localConvo, setLocalConvo] = useState<ConvoStep[]>(chatState?.convo ?? []);
  const [localTranscriptParts, setLocalTranscriptParts] = useState<string[]>(chatState?.transcriptParts ?? []);
  const [localPromptIdx, setLocalPromptIdx] = useState(chatState?.promptIdx ?? 0);
  const [localParsedAnswers, setLocalParsedAnswers] = useState<Record<string, string> | null>(chatState?.parsedAnswers ?? null);

  const flowState = chatState?.flowState ?? localFlowState;
  const convo = chatState?.convo ?? localConvo;
  const transcriptParts = chatState?.transcriptParts ?? localTranscriptParts;
  const promptIdx = chatState?.promptIdx ?? localPromptIdx;
  const parsedAnswers = chatState?.parsedAnswers ?? localParsedAnswers;

  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const convoEndRef = useRef<HTMLDivElement>(null);

  const transcribeMutation = trpc.voice.transcribeAndClean.useMutation();
  const parseMutation = trpc.voice.parseReflectionDump.useMutation();

  // Sync state changes to parent for persistence
  const updateState = useCallback((updates: Partial<ChatState>) => {
    const newState: ChatState = {
      flowState: updates.flowState ?? flowState,
      convo: updates.convo ?? convo,
      transcriptParts: updates.transcriptParts ?? transcriptParts,
      promptIdx: updates.promptIdx ?? promptIdx,
      parsedAnswers: updates.parsedAnswers ?? parsedAnswers,
    };
    if (onChatStateChange) {
      onChatStateChange(newState);
    } else {
      if (updates.flowState !== undefined) setLocalFlowState(updates.flowState);
      if (updates.convo !== undefined) setLocalConvo(updates.convo);
      if (updates.transcriptParts !== undefined) setLocalTranscriptParts(updates.transcriptParts);
      if (updates.promptIdx !== undefined) setLocalPromptIdx(updates.promptIdx);
      if (updates.parsedAnswers !== undefined) setLocalParsedAnswers(updates.parsedAnswers);
    }
  }, [flowState, convo, transcriptParts, promptIdx, parsedAnswers, onChatStateChange]);

  // Auto-scroll
  useEffect(() => {
    convoEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convo, flowState]);

  const startConversation = useCallback(() => {
    const firstPrompt = warmify(prompts[0].q, true);
    const newConvo: ConvoStep[] = [
      { role: 'friend', text: `Hey! 🌙 Ready to reflect? Let's chat through it together.` },
      { role: 'friend', text: firstPrompt },
    ];
    updateState({
      flowState: 'greeting',
      convo: newConvo,
      transcriptParts: [],
      promptIdx: 0,
      parsedAnswers: null,
    });

    // Auto-start recording
    setTimeout(() => {
      updateState({ flowState: 'listening' });
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mimeType = getBestMimeType();
        mimeTypeRef.current = mimeType || 'audio/webm';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      }).catch(() => {
        toast.error('Microphone access denied.');
        updateState({ flowState: 'idle' });
      });
    }, 1000);
  }, [prompts, updateState]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      updateState({ flowState: 'listening' });
    } catch {
      toast.error('Microphone access denied.');
    }
  }, [updateState]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { recorder.requestData(); } catch { /* ignore */ }

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => resolve(), 2000);
      recorder.onstop = () => { clearTimeout(timeout); resolve(); };
      recorder.stop();
    });
    recorder.stream.getTracks().forEach(t => t.stop());

    updateState({ flowState: 'thinking' });

    try {
      const actualMime = recorder.mimeType || mimeTypeRef.current;
      const ext = getExtForMime(actualMime);
      const blob = new Blob(chunksRef.current, { type: actualMime });
      chunksRef.current = [];

      if (blob.size < 500) {
        toast.error('Too short — try speaking a bit more.');
        startRecording();
        return;
      }

      const formData = new FormData();
      formData.append('audio', blob, `reflect-${Date.now()}.${ext}`);
      const uploadRes = await fetch('/api/voice/upload', { method: 'POST', body: formData, credentials: 'include' });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const { url: audioPath } = await uploadRes.json() as { url: string };
      const audioUrl = audioPath.startsWith('http') ? audioPath : `${window.location.origin}${audioPath}`;

      const result = await transcribeMutation.mutateAsync({ audioUrl, fieldHint: 'reflection' });
      transcribeMutation.reset();

      const userText = result.cleanedText || result.rawText || '';
      if (!userText) {
        toast.error("Didn't catch that — try again?");
        startRecording();
        return;
      }

      // Add user response
      const newConvo = [...convo, { role: 'you' as const, text: userText }];
      const newTranscripts = [...transcriptParts, userText];

      // Decide: ask follow-up for same prompt, or move to next prompt
      const followUp = FOLLOW_UPS[Math.floor(Math.random() * FOLLOW_UPS.length)];
      newConvo.push({ role: 'friend', text: followUp });

      updateState({
        convo: newConvo,
        transcriptParts: newTranscripts,
        flowState: 'follow-up',
      });
    } catch (err) {
      console.error('[ReflectionVoiceChat]', err);
      toast.error('Something went wrong. Try speaking again.');
      updateState({ flowState: 'follow-up' });
    }
  }, [convo, transcriptParts, transcribeMutation, startRecording, updateState]);

  const moveToNextPrompt = useCallback(() => {
    const nextIdx = promptIdx + 1;
    if (nextIdx >= prompts.length) {
      // All prompts covered — finish
      finishAndParse();
      return;
    }
    const nextQ = warmify(prompts[nextIdx].q, false);
    const newConvo = [...convo, { role: 'friend' as const, text: nextQ }];
    updateState({ convo: newConvo, promptIdx: nextIdx });
    startRecording();
  }, [promptIdx, prompts, convo, updateState, startRecording]);

  const finishAndParse = useCallback(async () => {
    if (transcriptParts.length === 0) {
      toast.error('Nothing recorded yet. Speak first!');
      return;
    }

    updateState({ flowState: 'wrapping' });

    try {
      const fullText = transcriptParts.join('\n\n');
      const result = await parseMutation.mutateAsync({
        text: fullText,
        prompts: prompts.map(p => ({ key: p.key, question: p.q })),
      });
      parseMutation.reset();

      const hasContent = Object.values(result.answers).some(v => v.trim());
      if (!hasContent) {
        toast.error("Couldn't make sense of the recording. Try again?");
        updateState({ flowState: 'follow-up' });
        return;
      }

      updateState({ parsedAnswers: result.answers, flowState: 'preview' });
    } catch (err) {
      console.error('[ReflectionVoiceChat] parse failed:', err);
      toast.error('Failed to organize your reflection. Try again.');
      updateState({ flowState: 'follow-up' });
    }
  }, [transcriptParts, prompts, parseMutation, updateState]);

  const applyAndClose = useCallback(() => {
    if (!parsedAnswers) return;
    onApply(parsedAnswers);
    updateState({ flowState: 'idle', convo: [], transcriptParts: [], promptIdx: 0, parsedAnswers: null });
    if (onChatStateChange) onChatStateChange(null);
    parseMutation.reset();
    toast.success('Reflection filled in! ✨');
  }, [parsedAnswers, onApply, updateState, onChatStateChange, parseMutation]);

  const discard = useCallback(() => {
    updateState({ flowState: 'idle', convo: [], transcriptParts: [], promptIdx: 0, parsedAnswers: null });
    if (onChatStateChange) onChatStateChange(null);
    parseMutation.reset();
  }, [updateState, onChatStateChange, parseMutation]);

  const cancelAll = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    chunksRef.current = [];
    updateState({ flowState: 'idle', convo: [], transcriptParts: [], promptIdx: 0, parsedAnswers: null });
    if (onChatStateChange) onChatStateChange(null);
    setRecordingSeconds(0);
    parseMutation.reset();
    transcribeMutation.reset();
  }, [updateState, onChatStateChange, parseMutation, transcribeMutation]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="mb-4 px-4">
      <AnimatePresence mode="wait">
        {/* IDLE */}
        {flowState === 'idle' && (
          <motion.button
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            onClick={startConversation}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-[var(--sky)]/40 bg-[var(--sky-mist)] text-[var(--sky)] font-semibold flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
          >
            <span className="text-xl">💬</span>
            <span>Chat your reflection</span>
          </motion.button>
        )}

        {/* CONVERSATION */}
        {flowState !== 'idle' && flowState !== 'preview' && (
          <motion.div
            key="convo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden shadow-sm"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[var(--sky-mist)] to-white flex items-center justify-between border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-base">🌙</span>
                <span className="text-sm font-semibold text-[var(--foreground)]">Reflection chat</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {promptIdx + 1}/{prompts.length}
                </span>
              </div>
              <button onClick={cancelAll} className="text-xs text-[var(--muted-foreground)] font-medium">Cancel</button>
            </div>

            {/* Bubbles */}
            <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
              {convo.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className={`flex ${step.role === 'friend' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    step.role === 'friend'
                      ? 'bg-[var(--sky-mist)] text-[var(--foreground)] rounded-bl-md'
                      : 'bg-[var(--sky)] text-white rounded-br-md'
                  }`}>
                    {step.text}
                  </div>
                </motion.div>
              ))}

              {flowState === 'thinking' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-[var(--sky-mist)] px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--sky)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--sky)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--sky)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}

              {flowState === 'wrapping' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-[var(--sky-mist)] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm text-[var(--foreground)]">
                    ✨ Organizing your reflections into the prompts…
                  </div>
                </motion.div>
              )}

              <div ref={convoEndRef} />
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 pt-2 border-t border-[var(--border)]">
              {flowState === 'listening' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-medium text-red-500">Listening…</span>
                    <span className="text-xs text-[var(--muted-foreground)] font-mono">{formatTime(recordingSeconds)}</span>
                  </div>
                  <button
                    onClick={stopAndTranscribe}
                    className="w-full py-3 rounded-xl bg-[var(--sky)] text-white font-semibold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
                    Done speaking
                  </button>
                </div>
              )}

              {flowState === 'follow-up' && (
                <div className="flex gap-2">
                  <button
                    onClick={startRecording}
                    className="flex-1 py-3 rounded-xl bg-[var(--sky-mist)] text-[var(--sky)] font-semibold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
                  >
                    🎙 More on this
                  </button>
                  {promptIdx < prompts.length - 1 ? (
                    <button
                      onClick={moveToNextPrompt}
                      className="flex-1 py-3 rounded-xl bg-[var(--sky)] text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                    >
                      Next prompt →
                    </button>
                  ) : (
                    <button
                      onClick={finishAndParse}
                      className="flex-1 py-3 rounded-xl bg-[var(--sky)] text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                    >
                      I'm done ✓
                    </button>
                  )}
                </div>
              )}

              {flowState === 'greeting' && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-xs text-[var(--muted-foreground)]">Starting mic…</span>
                </div>
              )}

              {flowState === 'thinking' && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-xs text-[var(--muted-foreground)]">Processing what you said…</span>
                </div>
              )}

              {flowState === 'wrapping' && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--sky)] border-t-transparent animate-spin" />
                  <span className="text-xs text-[var(--muted-foreground)]">Almost there…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* PREVIEW */}
        {flowState === 'preview' && parsedAnswers && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border-2 border-[var(--sky)]/30 bg-white overflow-hidden"
          >
            <div className="px-4 py-3 bg-[var(--sky-mist)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <span className="text-sm font-semibold text-[var(--sky)]">Here's what I got</span>
              </div>
              <button onClick={discard} className="text-xs text-[var(--muted-foreground)]">Start over</button>
            </div>

            <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
              {prompts.map(p => {
                const answer = parsedAnswers[p.key];
                if (!answer) return null;
                return (
                  <div key={p.key}>
                    <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
                      {p.q.replace(/^[^\w]+/, '').slice(0, 50)}
                    </p>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">{answer}</p>
                  </div>
                );
              })}
              {Object.values(parsedAnswers).every(v => !v.trim()) && (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-2">No content was extracted. Try again?</p>
              )}
            </div>

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
                Apply to reflection ✓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
