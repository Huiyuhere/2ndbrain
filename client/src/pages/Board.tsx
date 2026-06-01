import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { filterTasksByMode, Task, autoClassify, getTodayLabel } from '@/lib/store';
import UserAvatar from '@/components/UserAvatar';
import BottomNav from '@/components/BottomNav';
import GoalBanner from '@/components/GoalBanner';
import MorningCheckin from '@/components/MorningCheckin';
import TaskCard from '@/components/TaskCard';
import { motion, AnimatePresence } from 'framer-motion';

type Column = { id: Task['column']; label: string; emoji: string; headerClass: string; countClass: string };

const COLUMNS: Column[] = [
  { id: 'ideas',  label: 'Ideas',       emoji: '💡', headerClass: 'bg-[#FEF5E0] text-[#C9952A]', countClass: 'bg-[#C9952A] text-white' },
  { id: 'future', label: 'Future Goals', emoji: '🏔️', headerClass: 'bg-[#EFECE7] text-[#3D3A35]', countClass: 'bg-[#ABA59D] text-white' },
  { id: 'week',   label: 'This Week',   emoji: '📋', headerClass: 'bg-[#E8F4FB] text-[#0D6B9A]', countClass: 'bg-[#0D6B9A] text-white' },
  { id: 'today',  label: 'Do Today',    emoji: '⚡', headerClass: 'bg-[#D6EAF8] text-[#0D3B5E]', countClass: 'bg-[#0D3B5E] text-white' },
  { id: 'done',   label: 'Done',        emoji: '✅', headerClass: 'bg-[#E8F8F2] text-[#2E8B57]', countClass: 'bg-[#2E8B57] text-white' },
];

export default function Board() {
  const { state, loading, setFocusMode, addTask, moveTask, markCheckinDone } = useApp();
  const [showCheckin, setShowCheckin] = useState(false);
  const [dismissedCheckin, setDismissedCheckin] = useState(false);
  const [activeCol, setActiveCol] = useState(0);
  const [addingTo, setAddingTo] = useState<Task['column'] | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [dragOverCol, setDragOverCol] = useState<Task['column'] | null>(null);
  const dragTaskId = useRef<string | null>(null);

  // Open the morning check-in only AFTER data has loaded and only if not done today.
  // Once dismissed in this session, don't reopen until next page mount.
  useEffect(() => {
    if (loading) return;
    if (dismissedCheckin) return;
    setShowCheckin(!state.checkinDone);
  }, [loading, state.checkinDone, dismissedCheckin]);

  const filtered = filterTasksByMode(state.tasks, state.focusMode);
  const tasksByCol = (col: Task['column']) => filtered.filter(t => t.column === col);

  function handleAddTask() {
    if (!newTitle.trim() || !addingTo) return;
    addTask({ title: newTitle.trim(), column: addingTo, categoryId: autoClassify(newTitle, state.categories) });
    setNewTitle('');
    setAddingTo(null);
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    dragTaskId.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }

  function handleDragOver(e: React.DragEvent, colId: Task['column']) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  function handleDrop(e: React.DragEvent, colId: Task['column']) {
    e.preventDefault();
    const taskId = dragTaskId.current || e.dataTransfer.getData('text/plain');
    if (taskId) {
      moveTask(taskId, colId);
    }
    dragTaskId.current = null;
    setDragOverCol(null);
  }

  function handleDragEnd() {
    dragTaskId.current = null;
    setDragOverCol(null);
  }

  return (
    <div className="page-shell">
      {/* TOPBAR */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="font-[Playfair_Display] font-bold text-xl text-[var(--foreground)]">🌊 Board</h1>
          <p className="text-xs text-[var(--muted-foreground)]">{getTodayLabel()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="streak-badge">🔥 {state.streak}</span>
          <UserAvatar size={36} />
        </div>
      </div>

      {/* GOAL BANNER */}
      <GoalBanner />

      {/* FOCUS MODE SWITCHER */}
      <div className="px-4 mt-3 flex gap-2">
        {(['life', 'work', 'personal'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setFocusMode(mode)}
            className={`mode-pill ${state.focusMode === mode ? 'active-mode' : ''}`}
          >
            {mode === 'life' ? '🌊' : mode === 'work' ? '💼' : '🌸'}
            {mode === 'life' ? 'Life' : mode === 'work' ? 'Work' : 'Personal'}
          </button>
        ))}
      </div>

      {/* DRAG HINT */}
      <p className="text-center text-[10px] text-[var(--muted-foreground)] mt-2">Drag cards between columns to move them</p>

      {/* SCROLL DOTS */}
      <div className="flex gap-1.5 justify-center mt-1.5">
        {COLUMNS.map((_, i) => (
          <div key={i} className={`rounded-full transition-all ${i === activeCol ? 'w-4 h-1.5 bg-[var(--sky)]' : 'w-1.5 h-1.5 bg-[var(--border)]'}`} />
        ))}
      </div>

      {/* KANBAN BOARD */}
      <div
        className="kanban-scroll mt-2"
        onScroll={e => {
          const idx = Math.round((e.target as HTMLDivElement).scrollLeft / 272);
          setActiveCol(idx);
        }}
      >
        {COLUMNS.map(col => {
          const tasks = tasksByCol(col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              className={`kanban-col transition-all ${isOver ? 'ring-2 ring-[var(--sky)] ring-offset-1 rounded-2xl bg-[var(--sky-mist)]/40' : ''}`}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${col.headerClass}`}>
                <span className="text-sm font-bold">{col.emoji} {col.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.countClass}`}>{tasks.length}</span>
              </div>

              {/* Drop zone hint when dragging */}
              {isOver && (
                <div className="mb-2 py-2 border-2 border-dashed border-[var(--sky)] rounded-xl text-center text-xs text-[var(--sky)] font-semibold">
                  Drop here
                </div>
              )}

              {/* Tasks */}
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showBorder={col.id === 'today'}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                />
              ))}

              {/* Add task inline */}
              {addingTo === col.id ? (
                <div className="mt-1">
                  <input
                    autoFocus
                    className="w-full border border-[var(--sky)] rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                    placeholder="Task title..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setAddingTo(null); }}
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={handleAddTask} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white btn-sky">Add</button>
                    <button onClick={() => setAddingTo(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-[var(--border)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(col.id)}
                  className="w-full mt-1 py-2.5 border-2 border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--muted-foreground)] hover:border-[var(--sky-light)] hover:text-[var(--sky)] transition-all"
                >
                  + Add task
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => setAddingTo('today')}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full text-white text-2xl shadow-xl btn-sky flex items-center justify-center z-40 transition-transform active:scale-95"
      >
        +
      </button>

      <BottomNav />

      {/* MORNING CHECK-IN */}
      <AnimatePresence>
        {showCheckin && (
          <MorningCheckin onClose={() => { setShowCheckin(false); setDismissedCheckin(true); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
