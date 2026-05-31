import { Link, useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';

const NAV_ITEMS = [
  { href: '/board',       emoji: '🌊', label: 'Board'       },
  { href: '/today',       emoji: '⚡', label: 'Today'       },
  { href: '/calendar',    emoji: '🗓️', label: 'Calendar'    },
  { href: '/habits',      emoji: '🔥', label: 'Habits'      },
  { href: '/reflections', emoji: '🌙', label: 'Reflections' },
  { href: '/roadmap',     emoji: '🏔️', label: 'Roadmap'     },
  { href: '/analytics',   emoji: '📈', label: 'Analytics'   },
  { href: '/goals',       emoji: '💎', label: 'Goals'       },
  { href: '/settings',    emoji: '⚙️', label: 'Settings'    },
];

export default function SideNav() {
  const [location] = useLocation();
  const { state } = useApp();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <h1 className="font-['Playfair_Display'] font-bold text-xl text-[var(--foreground)]">2nd Brain</h1>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Your life OS</p>
      </div>

      {/* Goal strip */}
      <div className="mx-3 my-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">👑 Q2 Goal</p>
        <p className="text-white text-xs font-['Playfair_Display'] italic leading-snug line-clamp-2">{state.quarterlyGoal.text}</p>
        <div className="mt-2 w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${state.quarterlyGoal.progress}%`, background: 'linear-gradient(90deg, #F0B429, #C9952A)' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[#F0B429] text-[10px] font-bold">{state.quarterlyGoal.progress}%</span>
          <span className="text-white/60 text-[10px]">{state.quarterlyGoal.daysLeft}d left</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = location === item.href || (item.href === '/board' && (location === '/' || location === ''));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[var(--sky-mist)] text-[var(--sky)] font-semibold border-l-[3px] border-[var(--sky)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow shrink-0" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>TH</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">TH</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">🔥 {state.streak} day streak</p>
        </div>
      </div>
    </aside>
  );
}
