import { useState } from 'react';
import { Task } from '@/lib/store';
import { useApp } from '@/contexts/AppContext';
import CategoryPill from './CategoryPill';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  task: Task;
  showBorder?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};

export default function TaskCard({ task, showBorder = false, draggable: isDraggable = false, onDragStart }: Props) {
  const { updateTask, deleteTask, moveTask } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [addingLink, setAddingLink] = useState(false);

  function toggleSubtask(sid: string) {
    updateTask(task.id, {
      subtasks: task.subtasks?.map(s => s.id === sid ? { ...s, done: !s.done } : s),
    });
  }

  function saveEdit() {
    updateTask(task.id, { title: editTitle });
    setEditing(false);
  }

  function addLink() {
    if (!newLink.url) return;
    updateTask(task.id, {
      links: [...(task.links || []), { label: newLink.label || newLink.url, url: newLink.url }],
    });
    setNewLink({ label: '', url: '' });
    setAddingLink(false);
  }

  function removeLink(idx: number) {
    updateTask(task.id, { links: task.links?.filter((_, i) => i !== idx) });
  }

  const isDone = task.column === 'done';

  return (
    <div
      className={`task-card mb-2 ${showBorder ? 'border-l-[3px] border-l-[var(--sky)]' : ''} ${isDone ? 'opacity-60' : ''} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
    >
      {/* Main row */}
      <div className="flex items-start gap-2" onClick={() => setExpanded(e => !e)}>
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); moveTask(task.id, isDone ? 'today' : 'done'); }}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
            isDone ? 'bg-[var(--sky)] border-[var(--sky)]' : 'border-[var(--border)] hover:border-[var(--sky)]'
          }`}
        >
          {isDone && <span className="text-white text-xs">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <CategoryPill categoryId={task.categoryId} size="xs" />
            {task.duration && <span className="text-[10px] text-[var(--muted-foreground)] font-medium">{task.duration}</span>}
            {task.scheduledTime && <span className="text-[10px] bg-[var(--sky-mist)] text-[var(--sky)] font-semibold px-1.5 py-0.5 rounded-full">{task.scheduledTime}</span>}
            {task.notes === 'Overdue' && <span className="text-[10px] text-red-500 font-semibold">Overdue</span>}
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} ✓
              </span>
            )}
            {task.links && task.links.length > 0 && (
              <span className="text-[10px] text-[var(--sky)] font-medium">🔗 {task.links.length}</span>
            )}
          </div>
        </div>

        <span className={`text-[var(--muted-foreground)] text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-[var(--border)]">

              {/* Subtasks */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Subtasks</p>
                  {task.subtasks.map(s => (
                    <div key={s.id} className="flex items-center gap-2 py-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSubtask(s.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          s.done ? 'bg-[var(--sky)] border-[var(--sky)]' : 'border-[var(--border)]'
                        }`}
                      >
                        {s.done && <span className="text-white text-[9px]">✓</span>}
                      </button>
                      <span className={`text-xs ${s.done ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Links */}
              {task.links && task.links.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Links</p>
                  {task.links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-1.5 text-xs text-[var(--sky)] hover:underline"
                      >
                        🔗 {link.label}
                      </a>
                      <button onClick={() => removeLink(i)} className="text-[var(--muted-foreground)] hover:text-red-400 text-xs">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add link */}
              {addingLink ? (
                <div className="mb-3 space-y-2" onClick={e => e.stopPropagation()}>
                  <input
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--sky)]"
                    placeholder="Label (e.g. Figma)"
                    value={newLink.label}
                    onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))}
                  />
                  <input
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--sky)]"
                    placeholder="https://..."
                    value={newLink.url}
                    onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button onClick={addLink} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white btn-sky">Add</button>
                    <button onClick={() => setAddingLink(false)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setAddingLink(true); }}
                  className="text-xs text-[var(--sky)] font-medium mb-3 block"
                >
                  + Add link
                </button>
              )}

              {/* Edit / Delete */}
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                {editing ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--sky)]"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    />
                    <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white btn-sky">Save</button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)]">✕</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setEditing(true)} className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--sky)] hover:text-[var(--sky)] transition-all">
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteTask(task.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-red-100 text-red-400 hover:bg-red-50 transition-all">
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
