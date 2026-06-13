import { getQuoteOfDay } from '@/lib/quotes';
import { useState } from 'react';

/**
 * Quote of the Day banner. Replaces the large Q2 goal banner on
 * Board / Today / Habits. The Q2 goal still lives in the sidebar.
 * One quote is chosen deterministically per calendar day.
 */
export default function QuoteBanner() {
  const [quote] = useState(() => getQuoteOfDay());

  return (
    <div className="goal-banner mx-4 mt-3 p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5 shrink-0">✨</span>
        <div className="min-w-0">
          <div className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">
            Quote of the day
          </div>
          <p className="text-white font-['Playfair_Display'] italic text-[15px] leading-snug">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[var(--gold-bright)] text-[11px] font-semibold mt-1.5">
            — {quote.author}
          </p>
        </div>
      </div>
    </div>
  );
}
