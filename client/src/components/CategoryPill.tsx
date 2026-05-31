import { useApp } from '@/contexts/AppContext';

export default function CategoryPill({ categoryId, size = 'sm' }: { categoryId: string; size?: 'sm' | 'xs' }) {
  const { state } = useApp();
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5'}`}
      style={{ background: cat.bgColor, color: cat.textColor }}
    >
      {cat.emoji} {cat.name}
    </span>
  );
}
