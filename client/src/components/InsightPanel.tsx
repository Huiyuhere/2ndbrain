import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Streamdown } from 'streamdown';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type Period = 'weekly' | 'monthly' | 'quarterly';

const PERIOD_NOUN: Record<Period, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
};

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Collapsible "Show this period's insights" panel.
 * Collapsed by default. On open, fetches the cached insight; if none exists it
 * triggers generation. Renders markdown and offers Markdown download + regenerate.
 */
export default function InsightPanel({ period }: { period: Period }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const noun = PERIOD_NOUN[period];

  const generate = trpc.insights.generate.useMutation();

  async function ensureInsight(refresh = false) {
    setLoading(true);
    try {
      const res = await generate.mutateAsync({ period, refresh });
      setContent(res.content || '');
      setGeneratedAt(res.generatedAt ? new Date(res.generatedAt) : new Date());
      if (refresh) toast.success('Insight regenerated ✨');
    } catch {
      toast.error('Could not generate your review. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && content === null && !loading) {
      void ensureInsight(false);
    }
  }

  return (
    <div className="mx-4 mb-4">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-[var(--sky)]/30 bg-gradient-to-br from-[var(--sky-mist)] to-white text-left active:scale-[0.99] transition-transform"
        style={{ transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)' }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">✨</span>
          <span className="text-sm font-bold text-[var(--sky)] truncate">
            {content ? `Your ${noun}'s insights` : `Show this ${noun}'s insights`}
          </span>
        </span>
        <span
          className={`text-[var(--sky)] text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-4 rounded-2xl border border-[var(--border)] bg-white">
              {loading && content === null ? (
                <div className="flex items-center gap-3 py-6 justify-center text-[var(--muted-foreground)]">
                  <span className="inline-block w-4 h-4 border-2 border-[var(--sky)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Reviewing your {noun}…</span>
                </div>
              ) : content ? (
                <>
                  <div className="prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-h2:text-base prose-p:my-2 prose-li:my-0.5 prose-ul:my-2 leading-relaxed">
                    <Streamdown>{content}</Streamdown>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        downloadMarkdown(
                          `${period}-review-${new Date().toISOString().slice(0, 10)}.md`,
                          content
                        )
                      }
                      className="text-xs font-semibold text-[var(--sky)] px-3 py-2 rounded-xl border border-[var(--sky)]/30 active:scale-95 transition-transform"
                    >
                      📥 Download as Markdown
                    </button>
                    <button
                      onClick={() => void ensureInsight(true)}
                      disabled={loading}
                      className="text-xs font-semibold text-[var(--muted-foreground)] px-3 py-2 rounded-xl border border-[var(--border)] active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {loading ? 'Regenerating…' : '↻ Regenerate'}
                    </button>
                    {generatedAt && (
                      <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
                        {generatedAt.toLocaleString('en-SG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                  No insight yet for this {noun}.{' '}
                  <button onClick={() => void ensureInsight(true)} className="text-[var(--sky)] font-semibold">
                    Generate one →
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
