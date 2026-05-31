import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import BackButton from '@/components/BackButton';

export default function JournalViewer() {
  const { state } = useApp();
  const [tab, setTab] = useState<'morning' | 'evening'>('morning');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const morningEntries = [...(state.moodEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const eveningEntries = [...(state.eveningEntries || [])].sort((a, b) => b.date.localeCompare(a.date));

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function moodEmoji(mood: number) {
    const map: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '😊', 5: '😄' };
    return map[mood] ?? '😐';
  }

  return (
    <div className="pb-8">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">📖 Journal</div>
          <div className="topbar-sub">Morning &amp; evening entries</div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          <button className={`tab-btn ${tab === 'morning' ? 'active' : ''}`} onClick={() => setTab('morning')}>
            ☀️ Morning
          </button>
          <button className={`tab-btn ${tab === 'evening' ? 'active' : ''}`} onClick={() => setTab('evening')}>
            🌙 Evening
          </button>
        </div>
      </div>

      {/* MORNING ENTRIES */}
      {tab === 'morning' && (
        <div className="px-4 mt-4 space-y-3">
          {morningEntries.length === 0 && (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <p className="text-3xl mb-3">☀️</p>
              <p className="text-sm font-medium">No morning entries yet</p>
              <p className="text-xs mt-1">Complete your morning check-in on the Today page.</p>
            </div>
          )}
          {morningEntries.map(entry => {
            const isOpen = expandedId === `m-${entry.date}`;
            return (
              <div key={entry.date} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : `m-${entry.date}`)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg, #FFF3CD, #F0B429)' }}>
                    ☀️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(entry.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-[var(--muted-foreground)]">{moodEmoji(entry.mood)} Mood {entry.mood}/5</span>
                      <span className="text-xs text-[var(--muted-foreground)]">😴 {entry.sleep}h sleep</span>
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                    {entry.intention && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">🎯 Today's Intention</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{entry.intention}</p>
                      </div>
                    )}
                    {entry.focus && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">🔍 Focus</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{entry.focus}</p>
                      </div>
                    )}
                    {!entry.intention && !entry.focus && (
                      <p className="text-sm text-[var(--muted-foreground)] italic">No details recorded.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EVENING ENTRIES */}
      {tab === 'evening' && (
        <div className="px-4 mt-4 space-y-3">
          {eveningEntries.length === 0 && (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <p className="text-3xl mb-3">🌙</p>
              <p className="text-sm font-medium">No evening entries yet</p>
              <p className="text-xs mt-1">Complete your evening review on the Today page.</p>
            </div>
          )}
          {eveningEntries.map(entry => {
            const isOpen = expandedId === `e-${entry.date}`;
            const wins = entry.highlights.filter(h => h.type === '+');
            const lows = entry.highlights.filter(h => h.type === '-');
            return (
              <div key={entry.date} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : `e-${entry.date}`)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'linear-gradient(135deg, #E8D5F5, #6B5EA8)' }}>
                    🌙
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(entry.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-[var(--muted-foreground)]">⭐ {entry.rating}/10</span>
                      {entry.title && <span className="text-xs text-[var(--muted-foreground)] truncate">{entry.title}</span>}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                    {entry.location && (
                      <p className="text-xs text-[var(--muted-foreground)]">📍 {entry.location}</p>
                    )}
                    {wins.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">🏆 Highlights</p>
                        <ul className="space-y-1">
                          {wins.map((h, i) => (
                            <li key={i} className="text-sm text-[var(--foreground)] flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">+</span>
                              {h.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lows.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">📈 Improvements</p>
                        <ul className="space-y-1">
                          {lows.map((h, i) => (
                            <li key={i} className="text-sm text-[var(--foreground)] flex items-start gap-2">
                              <span className="text-orange-400 mt-0.5">−</span>
                              {h.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.freeWrite && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">📝 Free Write</p>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">{entry.freeWrite}</p>
                      </div>
                    )}
                    {entry.photoUrl && (
                      <img src={entry.photoUrl} alt="Day photo" className="w-full rounded-xl object-cover max-h-48" />
                    )}
                    {!wins.length && !lows.length && !entry.freeWrite && (
                      <p className="text-sm text-[var(--muted-foreground)] italic">No details recorded.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
