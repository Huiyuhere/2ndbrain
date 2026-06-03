import { useState, useRef, useEffect } from 'react';
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
  const { updateTask, deleteTask, moveTask, state } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [addingLink, setAddingLink] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const catPickerRef = useRef<HTMLDivElement>(null);

  // Close category picker when clicking outside
  useEffect(() => {
    if (!showCatPicker) return;
    function handleClick(e: MouseEvent) {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setShowCatPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCatPicker]);

  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter(s => s.done).length;

  function toggleSubtask(sid: string) {
    updateTask(task.id, {
      subtasks: subtasks.map(s => s.id === sid ? { ...s, done: !s.done } : s),
    });
  }

  function addSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) {
      setAddingSubtask(false);
      return;
    }
    const newSub = { id: crypto.randomUUID(), title, done: false };
    updateTask(task.id, { subtasks: [...subtasks, newSub] });
    setNewSubtaskTitle('');
    setAddingSubtask(false);
  }

  function removeSubtask(sid: string) {
    updateTask(task.id, { subtasks: subtasks.filter(s => s.id !== sid) });
  }

  function commitTitle(el: HTMLElement) {
    const t = (el.textContent ?? '').trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else el.textContent = task.title;
  }

  function commitSub(el: HTMLElement, sid: string, original: string) {
    const t = (el.textContent ?? '').trim();
    if (t && t !== original) updateTask(task.id, { subtasks: subtasks.map(s => s.id === sid ? { ...s, title: t } : s) });
    else el.textContent = original;
  }

  function handleEditableKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
    else if (e.key === 'Escape') { (e.target as HTMLElement).blur(); }
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
          <p
            className={`text-sm font-medium leading-snug rounded px-0.5 -mx-0.5 outline-none focus:bg-[var(--muted)] focus:ring-1 focus:ring-[var(--sky)] ${isDone ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}
            suppressContentEditableWarning
            onDoubleClick={e => {
              e.stopPropagation();
              const el = e.currentTarget;
              el.contentEditable = 'plaintext-only';
              el.focus();
            }}
            onClick={e => { if ((e.currentTarget as HTMLElement).isContentEditable) e.stopPropagation(); }}
            onKeyDown={handleEditableKeyDown}
            onBlur={e => { commitTitle(e.currentTarget); e.currentTarget.contentEditable = 'false'; }}
            title="Double-tap to edit"
          >
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <div className="relative" ref={catPickerRef} onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { e.stopPropagation(); setShowCatPicker(v => !v); }}
                className="group flex items-center gap-0.5"
                title="Change category"
              >
                <CategoryPill categoryId={task.categoryId} size="xs" />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity -ml-0.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              {showCatPicker && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-[var(--border)] p-2 min-w-[160px]">
                  <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest px-2 pb-1.5">Change tag</p>
                  {state.categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { updateTask(task.id, { categoryId: cat.id }); setShowCatPicker(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--muted)] ${
                        cat.id === task.categoryId ? 'bg-[var(--muted)]' : ''
                      }`}
                    >
                      <span
                        className="inline-flex items-center gap-1 rounded-full text-[10px] px-2 py-0.5 font-semibold"
                        style={{ background: cat.bgColor, color: cat.textColor }}
                      >
                        {cat.emoji} {cat.name}
                      </span>
                      {cat.id === task.categoryId && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[var(--sky)]"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {task.duration && <span className="text-[10px] text-[var(--muted-foreground)] font-medium">{task.duration}</span>}
            {task.scheduledTime && <span className="text-[10px] bg-[var(--sky-mist)] text-[var(--sky)] font-semibold px-1.5 py-0.5 rounded-full">{task.scheduledTime}</span>}
            {task.notes === 'Overdue' && <span className="text-[10px] text-red-500 font-semibold">Overdue</span>}
            {subtasks.length > 0 && (
              <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                {doneCount}/{subtasks.length}
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

              {/* Subtasks section */}
              <div className="mb-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Subtasks</p>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-[var(--muted-foreground)]">{doneCount} / {subtasks.length}</span>
                  )}
                </div>

                {subtasks.length > 0 && (
                  <div className="mb-1">
                    {subtasks.map(s => (
                      <div key={s.id} className="group flex items-center gap-2.5 py-1">
                        <button
                          onClick={() => toggleSubtask(s.id)}
                          className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
                            s.done ? 'bg-[var(--foreground)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--sky)]'
                          }`}
                        >
                          {s.done && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                        <span
                          className={`text-sm flex-1 rounded px-0.5 -mx-0.5 outline-none focus:bg-[var(--muted)] focus:ring-1 focus:ring-[var(--sky)] ${s.done ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}
                          suppressContentEditableWarning
                          onDoubleClick={e => {
                            const el = e.currentTarget;
                            el.contentEditable = 'plaintext-only';
                            el.focus();
                          }}
                          onKeyDown={handleEditableKeyDown}
                          onBlur={e => { commitSub(e.currentTarget, s.id, s.title); e.currentTarget.contentEditable = 'false'; }}
                          title="Double-tap to edit"
                        >
                          {s.title}
                        </span>
                        <button
                          onClick={() => removeSubtask(s.id)}
                          className="text-[var(--muted-foreground)] hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          aria-label="Remove subtask"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addingSubtask ? (
                  <div className="flex items-center gap-2.5 py-1">
                    <div className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] border-[var(--border)] shrink-0" />
                    <input
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                      placeholder="Subtask title"
                      value={newSubtaskTitle}
                      onChange={e => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addSubtask();
                        else if (e.key === 'Escape') { setNewSubtaskTitle(''); setAddingSubtask(false); }
                      }}
                      onBlur={addSubtask}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingSubtask(true)}
                    className="flex items-center gap-2.5 py-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--sky)] transition-colors"
                  >
                    <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-base leading-none">+</span>
                    Add subtask…
                  </button>
                )}
              </div>

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
                    <button onClick={() => setEditing(true)} className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--sky)] hover:text-[var(--sky)] transition-all flex items-center justify-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button onClick={() => deleteTask(task.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:border-red-300 hover:text-red-400 transition-all flex items-center justify-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      Delete
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
