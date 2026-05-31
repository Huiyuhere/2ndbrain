import { Link, useLocation } from 'wouter';

const NAV_ITEMS = [
  { href: '/board',    emoji: '🌊', label: 'Board'    },
  { href: '/today',    emoji: '⚡', label: 'Today'    },
  { href: '/calendar', emoji: '🗓️', label: 'Calendar' },
  { href: '/habits',   emoji: '🔥', label: 'Habits'   },
  { href: '/more',     emoji: '✦',  label: 'More'     },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="bottom-nav md:hidden">
      {NAV_ITEMS.map(item => {
        const active = location === item.href || (item.href === '/board' && (location === '/' || location === ''));
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-all ${
              active ? 'text-[var(--sky)]' : 'text-[var(--muted-foreground)]'
            }`}>
            <span className="text-xl leading-none">{item.emoji}</span>
            <span className={`text-[10px] font-semibold ${active ? 'text-[var(--sky)]' : ''}`}>{item.label}</span>
            {active && <span className="w-1 h-1 rounded-full bg-[var(--sky)] mt-0.5" />}
          </Link>
        );
      })}
    </nav>
  );
}
