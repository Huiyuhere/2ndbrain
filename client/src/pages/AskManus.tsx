import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Streamdown } from 'streamdown';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  "When am I most productive, and what's dragging my completion rate down?",
  "What patterns show up before my best and worst days?",
  "Based on my journal, what should I focus on this week?",
  "I'm feeling stuck — what does my data say about when I break out of slumps?",
  "Give me honest advice based on everything you know about me.",
];

export default function AskManus() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ask = trpc.askManus.ask.useMutation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const nextHistory: ChatMsg[] = [...messages, { role: 'user', content: q }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const res = await ask.mutateAsync({ history: nextHistory });
      setMessages([...nextHistory, { role: 'assistant', content: res.answer || '…' }]);
    } catch {
      toast.error('Could not answer that. Try again in a moment.');
      // roll back the optimistic user message so they can retry
      setMessages(messages);
      setInput(q);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[100dvh] md:h-screen">
      {/* Header */}
      <div className="topbar shrink-0">
        <div>
          <BackButton fallback="/analytics" label="Analytics" />
          <div className="topbar-title mt-0.5">✨ Ask Manus</div>
          <div className="topbar-sub">Your personal AI advisor — knows your full context</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {empty ? (
          <div className="max-w-2xl mx-auto pt-2">
            <div className="p-4 rounded-2xl border border-[var(--sky)]/30 bg-gradient-to-br from-[var(--sky-mist)] to-white">
              <p className="text-sm font-bold text-[var(--sky)] mb-1">Your personal AI advisor</p>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                I know your full context — tasks, journal entries, mood, sleep, habits, goals, projects, and reflections.
                Ask me anything: productivity patterns, life decisions, advice, planning, or just to think something through.
                My advice is grounded in what you've actually logged.
              </p>
            </div>

            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mt-5 mb-2 px-1">
              Try asking
            </p>
            <div className="space-y-2">
              {STARTERS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => void send(s)}
                  className="w-full text-left text-sm px-4 py-3 rounded-2xl border border-[var(--border)] bg-white hover:border-[var(--sky)]/40 active:scale-[0.99] transition-all"
                  style={{ transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)' }}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto pt-2 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--sky)] text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[92%] px-4 py-3 rounded-2xl rounded-bl-md border border-[var(--border)] bg-white">
                      <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1.5 prose-h2:text-base prose-h3:text-sm prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1.5 leading-relaxed">
                        <Streamdown>{m.content}</Streamdown>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md border border-[var(--border)] bg-white flex items-center gap-2 text-[var(--muted-foreground)]">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--sky)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Reading your data…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask me anything…"
            className="flex-1 resize-none max-h-32 px-4 py-3 rounded-2xl border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--sky)]/50 focus:ring-2 focus:ring-[var(--sky)]/20 transition-all"
          />
          <button
            onClick={() => void send(input)}
            disabled={loading || !input.trim()}
            className="shrink-0 h-11 px-4 rounded-2xl bg-[var(--sky)] text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
            style={{ transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)' }}
            aria-label="Send"
          >
            Send
          </button>
        </div>
        <p className="max-w-2xl mx-auto text-[10px] text-[var(--muted-foreground)] mt-2 px-1">
          Advice is grounded in your logged data. This chat isn't saved — it clears when you leave.
        </p>
      </div>
    </div>
  );
}
