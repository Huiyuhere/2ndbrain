// WeekStrip — shared week header used by Today and Calendar pages.
// Ocean Empire design: active day gets sky-blue gradient pill, others are white with border.
// Supports optional event dots and optional click handler for day selection.

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getWeekDays(): Date[] {
  const today = new Date(2026, 4, 31); // May 31 2026
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return d;
  });
}

type Props = {
  /** Index of the currently active/selected day (0 = Sun). Defaults to today. */
  activeIndex?: number;
  /** Called when user taps a day pill. If omitted, the strip is display-only. */
  onDaySelect?: (index: number) => void;
  /** Per-day event dot: pass an array of booleans (length 7) to show dots */
  eventDots?: boolean[];
};

export default function WeekStrip({ activeIndex, onDaySelect, eventDots }: Props) {
  const weekDays = getWeekDays();
  const todayIdx = weekDays.findIndex(d => d.getDate() === 31 && d.getMonth() === 4);
  const active = activeIndex ?? todayIdx;

  return (
    <div className="flex gap-1.5 px-4 mt-3 overflow-x-auto pb-1 scrollbar-none">
      {weekDays.map((d, i) => {
        const isActive = i === active;
        const hasEvent = eventDots?.[i] ?? false;
        const Tag = onDaySelect ? 'button' : 'div';
        return (
          <Tag
            key={i}
            onClick={onDaySelect ? () => onDaySelect(i) : undefined}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-2.5 rounded-2xl min-w-[46px] transition-all select-none ${
              isActive
                ? 'text-white shadow-md'
                : 'bg-white border border-[var(--border)] text-[var(--muted-foreground)]'
            } ${onDaySelect ? 'cursor-pointer hover:shadow-sm active:scale-95' : ''}`}
            style={isActive ? { background: 'linear-gradient(160deg, #2E86C1 0%, #5DADE2 100%)' } : {}}
          >
            <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-white/80' : ''}`}>
              {DAYS_SHORT[d.getDay()]}
            </span>
            <span className={`text-base font-bold leading-none ${isActive ? 'text-white' : ''}`}>
              {d.getDate()}
            </span>
            {/* Event dot */}
            <span className={`w-1.5 h-1.5 rounded-full transition-all ${
              hasEvent
                ? isActive ? 'bg-white/70' : 'bg-[var(--sky)]'
                : 'opacity-0'
            }`} />
          </Tag>
        );
      })}
    </div>
  );
}
