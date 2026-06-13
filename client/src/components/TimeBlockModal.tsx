import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { TimeBlock, TASK_TYPES, minToTime, timeToMin } from '@/lib/store';
import { toast } from 'sonner';

export type TimeBlockDraft = {
  id?: string; // present when editing
  date: string;
  startMin: number;
  endMin: number;
  title?: string;
  categoryId?: string | null;
  taskType?: string | null;
  recurFreq?: 'daily' | 'weekly' | null;
  recurEndDate?: string | null;
};

type Props = {
  draft: TimeBlockDraft | null;
  onClose: () => void;
};

/** Create / edit a calendar time block. */
export default function TimeBlockModal({ draft, onClose }: Props) {
  const { state, addTimeBlock, updateTimeBlock, deleteTimeBlock } = useApp();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurEndDate, setRecurEndDate] = useState('');

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title ?? '');
    setStart(minToTime(draft.startMin));
    setEnd(minToTime(draft.endMin));
    setCategoryId(draft.categoryId ?? null);
    setTaskType(draft.taskType ?? null);
    setRepeat(draft.recurFreq ?? 'none');
    setRecurEndDate(draft.recurEndDate ?? '');
  }, [draft]);

  if (!draft) return null;
  const isEditing = !!draft.id;

  function handleSave() {
    if (!draft) return;
    const startMin = timeToMin(start);
    const endMin = timeToMin(end);
    if (startMin == null || endMin == null) {
      toast.error('Please enter valid times.');
      return;
    }
    if (endMin <= startMin) {
      toast.error('End time must be after start time.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give your time block a title.');
      return;
    }
    const payload = {
      title: title.trim(),
      date: draft.date,
      startMin,
      endMin,
      categoryId: categoryId ?? null,
      taskType: taskType ?? null,
      recurFreq: repeat === 'none' ? null : repeat,
      recurEndDate: repeat === 'none' || !recurEndDate ? null : recurEndDate,
    };
    if (isEditing && draft.id) {
      updateTimeBlock(draft.id, payload);
      toast.success('Time block updated');
    } else {
      addTimeBlock(payload as Omit<TimeBlock, 'id' | 'createdAt'>);
      toast.success('Time block added');
    }
    onClose();
  }

  function handleDelete() {
    if (!draft?.id) return;
    deleteTimeBlock(draft.id);
    toast.success('Time block deleted');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] mx-4 bg-white rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <p className="font-bold text-lg text-[var(--foreground)] mb-1">
          {isEditing ? 'Edit time block' : 'New time block'}
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">{draft.date}</p>

        {/* Title */}
        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Title</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Deep work, Gym, Lunch with Sam"
          className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm mb-4 outline-none focus:border-[var(--sky-light)]"
        />

        {/* Time range */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm outline-none focus:border-[var(--sky-light)]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">End</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm outline-none focus:border-[var(--sky-light)]" />
          </div>
        </div>

        {/* Category */}
        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Category</label>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {state.categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                categoryId === c.id ? 'border-transparent' : 'border-[var(--border)] opacity-70'
              }`}
              style={categoryId === c.id ? { background: c.bgColor, color: c.textColor } : {}}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        {/* Type */}
        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Type</label>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {TASK_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setTaskType(taskType === t.id ? null : t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                taskType === t.id ? 'border-transparent text-white' : 'border-[var(--border)] opacity-70 text-[var(--muted-foreground)]'
              }`}
              style={taskType === t.id ? { background: t.color } : {}}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Repeat */}
        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Repeat</label>
        <div className="flex gap-1.5 mb-3">
          {(['none', 'daily', 'weekly'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRepeat(r)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all capitalize ${
                repeat === r ? 'border-transparent text-white btn-sky' : 'border-[var(--border)] text-[var(--muted-foreground)]'
              }`}
            >
              {r === 'none' ? "Doesn't repeat" : r}
            </button>
          ))}
        </div>
        {repeat !== 'none' && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Until (optional)</label>
            <input type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm outline-none focus:border-[var(--sky-light)]" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          {isEditing && (
            <button onClick={handleDelete}
              className="px-4 py-3 rounded-2xl text-sm font-semibold border-2 border-[var(--border)] text-[#C0392B] hover:bg-[#FDECEA] transition-colors">
              Delete
            </button>
          )}
          <button onClick={handleSave} className="flex-1 py-3 rounded-2xl text-white font-bold btn-sky">
            {isEditing ? 'Save changes' : 'Add block'}
          </button>
        </div>
      </div>
    </div>
  );
}
