import { useApp } from '@/contexts/AppContext';

export default function GoalBanner({ compact = false }: { compact?: boolean }) {
  const { state } = useApp();
  const { text, progress, daysLeft } = state.quarterlyGoal;

  if (compact) {
    return (
      <div className="goal-banner mx-4 mt-3 p-3 flex items-center gap-3">
        <span className="text-lg">👑</span>
        <p className="text-white text-xs font-medium flex-1 leading-snug font-[Playfair_Display] italic line-clamp-1">{text}</p>
        <span className="text-[var(--gold-bright)] text-xs font-bold whitespace-nowrap">{progress}%</span>
      </div>
    );
  }

  return (
    <div className="goal-banner mx-4 mt-3 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">👑 Q2 Focus Goal</div>
          <p className="text-white font-[Playfair_Display] italic text-[15px] leading-snug">{text}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[var(--gold-bright)] font-bold text-lg leading-none">{progress}%</div>
          <div className="text-white/60 text-[10px] mt-0.5">{daysLeft}d left</div>
        </div>
      </div>
      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F0B429, #C9952A)' }}
        />
      </div>
    </div>
  );
}
