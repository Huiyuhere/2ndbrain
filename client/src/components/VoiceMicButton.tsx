/**
 * VoiceMicButton
 *
 * A microphone button that:
 * 1. Starts recording audio via MediaRecorder
 * 2. Opens VoiceRecordingSheet while recording
 * 3. On stop: uploads audio blob to /api/voice/upload
 * 4. Calls trpc.voice.transcribeAndClean to get cleaned text
 * 5. Calls onTranscript(cleanedText) to inject into the parent field
 *
 * Props:
 *  onTranscript(text: string) — called with the cleaned transcript
 *  fieldHint? — optional label describing the field (e.g. "morning intention")
 *  className? — extra Tailwind classes on the button
 */
import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import VoiceRecordingSheet from './VoiceRecordingSheet';

interface Props {
  onTranscript: (text: string) => void;
  fieldHint?: string;
  className?: string;
}

type State = 'idle' | 'recording' | 'processing';

/** Pick the best MIME type supported by this browser (iOS = mp4, Chrome/Firefox = webm) */
function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/** Get the file extension for a given MIME type */
function getExtForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

export default function VoiceMicButton({ onTranscript, fieldHint, className = '' }: Props) {
  const [state, setState] = useState<State>('idle');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const transcribeMutation = trpc.voice.transcribeAndClean.useMutation();
  // Reset mutation state after each call so subsequent calls go through
  const resetMutation = useCallback(() => transcribeMutation.reset(), [transcribeMutation]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio analyser for waveform visualisation
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // 1s chunks — more reliable on iOS Safari
      setState('recording');
    } catch (err) {
      console.error('[VoiceMicButton] getUserMedia failed:', err);
      toast.error('Microphone access denied. Please allow microphone access and try again.');
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setState('processing');

    // Clean up audio context + analyser
    setAnalyserNode(null);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    // Request any remaining data before stopping (not all browsers support this)
    try { recorder.requestData(); } catch { /* ignore */ }

    // Stop the recorder with timeout fallback (iOS Safari onstop can be unreliable)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 2000); // 2s safety timeout
      recorder.onstop = () => {
        clearTimeout(timeout);
        resolve();
      };
      recorder.stop();
    });

    // Stop microphone tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const actualMime = recorder.mimeType || 'audio/webm';
    const ext = getExtForMime(actualMime);
    const blob = new Blob(chunksRef.current, { type: actualMime });
    chunksRef.current = [];

    if (blob.size < 500) {
      toast.error('Recording was too short. Please try again.');
      setState('idle');
      return;
    }

    try {
      // Step 1: Upload audio blob to get a storage URL
      const formData = new FormData();
      formData.append('audio', blob, `recording.${ext}`);
      const uploadResp = await fetch('/api/voice/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => '');
        throw new Error(`Upload failed (${uploadResp.status}): ${errText}`);
      }
      const { url: audioPath } = await uploadResp.json() as { url: string };

      // Convert relative path to full URL for Zod .url() validation
      const audioUrl = audioPath.startsWith('http') ? audioPath : `${window.location.origin}${audioPath}`;

      // Step 2: Transcribe + clean via tRPC
      const result = await transcribeMutation.mutateAsync({
        audioUrl,
        fieldHint,
      });

      const text = result.cleanedText || result.rawText;
      if (text) {
        onTranscript(text);
        toast.success('Voice input added ✓');
      } else {
        toast.warning('No speech detected. Please try again.');
      }
    } catch (err) {
      console.error('[VoiceMicButton] transcription failed:', err);
      toast.error('Voice transcription failed. Please try again.');
    } finally {
      setState('idle');
      resetMutation();
    }
  }, [fieldHint, onTranscript, transcribeMutation, resetMutation]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setAnalyserNode(null);
    chunksRef.current = [];
    setState('idle');
  }, []);

  const handleClick = () => {
    if (state === 'idle') startRecording();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'processing'}
        title={state === 'idle' ? 'Tap to record voice input' : undefined}
        className={[
          'flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 shrink-0',
          state === 'idle'
            ? 'w-8 h-8 text-gray-400 hover:text-sky-500 hover:bg-sky-50'
            : state === 'recording'
              ? 'w-8 h-8 text-red-500 bg-red-50 animate-pulse'
              : 'w-8 h-8 text-sky-400 bg-sky-50 cursor-wait',
          className,
        ].join(' ')}
      >
        {state === 'processing' ? (
          // Spinner
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ) : state === 'recording' ? (
          // Pulsing mic (red)
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
            <path d="M19 10a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          // Idle mic
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
            <path d="M19 10a7 7 0 0 1-14 0"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}
      </button>

      <VoiceRecordingSheet
        isOpen={state === 'recording' || state === 'processing'}
        isProcessing={state === 'processing'}
        onStop={stopAndProcess}
        onCancel={cancelRecording}
        analyserNode={analyserNode}
      />
    </>
  );
}
