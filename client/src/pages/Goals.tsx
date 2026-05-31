// 2nd Brain — Goals page
// Goals are binary: checked (done) or unchecked. No progress bars.
// Monthly intention lives in /reflections.

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Goal } from '@/lib/store';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

const EMOJI_OPTIONS = ['🎯','🚀','📱','📚','💪','🌐','🧠','💡','🏆','🎨','🌿','💰','🏃','✍️','🎵'];

type GoalForm = { title: string; emoji: string };
const EMPTY_FORM: GoalForm = { title: '', emoji: '🎯' };

export default function Goals() {
  const { state, updateQuarterlyGoal, addGoal, updateGoal, deleteGoal } = useApp();
  const [editingQGoal, setEditingQGoal] = useState(false);
  const [qGoalText, setQGoalText] = useState(state.quarterlyGoal.text);
  const [qProgress, setQProgress] = useState(state.quarterlyGoal.progress);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalForm>(EMPTY_FORM);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleAdd() {
    if (!form.title.trim()) return;
    addGoal({ title: form.title.trim(), categoryId: 'work', progress: 0 });
    toast.success(`Goal "${form.title.trim()}" added!`);
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  function openEdit(g: Goal) {
    setEditId(g.id);
    setEditForm({ title: g.title, emoji: '🎯' });
  }

  function handleEdit() {
    if (!editId || !editForm.title.trim()) return;
    updateGoal(editId, { title: editForm.title.trim() });
    toast.success('Goal updated!');
    setEditId(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    const g = state.goals.find(g => g.id === deleteId);
    deleteGoal(deleteId);
    toast.success(`Goal "${g?.title}" deleted`);
    setDeleteId(null);
  }

  function toggleGoal(g: Goal) {
    // progress 100 = done, 0 = not done
    updateGoal(g.id, { progress: g.progress >= 100 ? 0 : 100 });
  }

  function saveQGoal() {
    updateQuarterlyGoal({ text: qGoalText, progress: qProgress });
    setEditingQGoal(false);
    toast.success('Q2 goal updated!');
  }

  const done = state.goals.filter(g => g.progress >= 100);
  const pending = state.goals.filter(g => g.progress < 100);

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">💎 Goals</div>
          <div className="topbar-sub">Q2 2026 · Apr – Jun</div>
        </div>
        <button onClick={() => setAddOpen(true)} className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky">+ Goal</button>
      </div>

      {/* Q2 FOCUS GOAL */}
      <div className="mx-4 mt-3 p-5 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">👑 Q2 Focus Goal</p>
            {editingQGoal ? (
              <>
                <textarea
                  className="w-full bg-white/20 text-white rounded-xl p-2 text-sm font-['Playfair_Display'] italic border border-white/30 outline-none resize-none mb-2"
                  value={qGoalText}
                  onChange={e => setQGoalText(e.target.value)}
                  rows={2}
                />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/70 text-xs">Progress: {qProgress}%</span>
                  <input
                    type="range" min={0} max={100} value={qProgress}
                    onChange={e => setQProgress(Number(e.target.value))}
                    className="flex-1 accent-[#F0B429]"
                  />
                </div>
              </>
            ) : (
              <p className="text-white font-['Playfair_Display'] italic text-base leading-snug">{state.quarterlyGoal.text}</p>
            )}
          </div>
          <button
            onClick={() => editingQGoal ? saveQGoal() : setEditingQGoal(true)}
            className="text-white/70 hover:text-white shrink-0 mt-1 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            {editingQGoal ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            )}
          </button>
        </div>
        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${state.quarterlyGoal.progress}%`, background: 'linear-gradient(90deg, #F0B429, #C9952A)' }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[#F0B429] text-sm font-bold">{state.quarterlyGoal.progress}% complete</span>
          <span className="text-white/60 text-xs">{state.quarterlyGoal.daysLeft} days left</span>
        </div>
      </div>

      {/* PENDING GOALS */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">🎯 Goals</div>
        <span className="section-hdr-action cursor-pointer" onClick={() => setAddOpen(true)}>+ Add</span>
      </div>
      <div className="px-4 space-y-2">
        {pending.map(g => (
          <GoalRow key={g.id} g={g} onToggle={() => toggleGoal(g)} onEdit={() => openEdit(g)} onDelete={() => setDeleteId(g.id)} />
        ))}
        {pending.length === 0 && (
          <div className="text-center py-6 text-[var(--muted-foreground)]">
            <p className="text-2xl mb-1">🎯</p>
            <p className="text-sm">All goals completed! Add a new one.</p>
          </div>
        )}
      </div>

      {/* COMPLETED GOALS */}
      {done.length > 0 && (
        <>
          <div className="section-hdr mt-4">
            <div className="section-hdr-title">✅ Completed</div>
          </div>
          <div className="px-4 space-y-2">
            {done.map(g => (
              <GoalRow key={g.id} g={g} onToggle={() => toggleGoal(g)} onEdit={() => openEdit(g)} onDelete={() => setDeleteId(g.id)} done />
            ))}
          </div>
        </>
      )}

      {state.goals.length === 0 && (
        <div className="text-center py-8 text-[var(--muted-foreground)] px-4">
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-sm">No goals yet. Tap + Goal to add your first one.</p>
        </div>
      )}

      {/* QUARTERLY REVIEW CTA */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-[var(--gold-glow)] border border-[var(--gold)]/20">
        <p className="text-sm font-semibold text-[var(--gold)] mb-1">📋 Quarterly Review</p>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">Q1 2026 review is ready. 30 mins to close the loop.</p>
        <a href="/reflections" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)]">
          Start Q1 Review →
        </a>
      </div>

      {/* ADD GOAL MODAL */}
      {addOpen && (
        <GoalModal
          title="Add new goal"
          form={form}
          setForm={setForm}
          onSave={handleAdd}
          onClose={() => { setAddOpen(false); setForm(EMPTY_FORM); }}
          saveLabel="Add goal"
        />
      )}

      {/* EDIT GOAL MODAL */}
      {editId && (
        <GoalModal
          title="Edit goal"
          form={editForm}
          setForm={setEditForm}
          onSave={handleEdit}
          onClose={() => setEditId(null)}
          saveLabel="Save changes"
        />
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-[360px] mx-4 bg-white rounded-3xl p-6 shadow-2xl text-center">
            <p className="text-3xl mb-3">🗑️</p>
            <h3 className="font-['Playfair_Display'] font-bold text-base mb-2">Delete this goal?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-[var(--border)]">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl text-white font-bold bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalRow({ g, onToggle, onEdit, onDelete, done }: {
  g: Goal;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  done?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-white transition-all ${done ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${done ? 'bg-[var(--sky)] border-[var(--sky)]' : 'border-[var(--border)] hover:border-[var(--sky)]'}`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        )}
      </button>
      {/* Title */}
      <p className={`flex-1 text-sm font-semibold text-[var(--foreground)] leading-snug ${done ? 'line-through text-[var(--muted-foreground)]' : ''}`}>{g.title}</p>
      {/* Edit / Delete */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-all"
          title="Edit goal"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-base leading-none"
        >×</button>
      </div>
    </div>
  );
}

function GoalModal({ title, form, setForm, onSave, onClose, saveLabel }: {
  title: string;
  form: GoalForm;
  setForm: React.Dispatch<React.SetStateAction<GoalForm>>;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] mx-4 bg-white rounded-3xl p-6 shadow-2xl">
        <h3 className="font-['Playfair_Display'] font-bold text-lg mb-4">{title}</h3>

        {/* Emoji */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Emoji</p>
          <div className="flex gap-2 flex-wrap">
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                className={`w-10 h-10 rounded-xl text-xl border-2 transition-all ${form.emoji === e ? 'border-[var(--sky)] bg-[var(--sky-mist)]' : 'border-[var(--border)]'}`}
              >{e}</button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <p className="text-sm font-semibold mb-1">Goal title *</p>
          <input
            className="input-field"
            placeholder="e.g. Read 12 books this year"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-[var(--border)] text-[var(--muted-foreground)]">Cancel</button>
          <button onClick={onSave} disabled={!form.title.trim()} className="flex-1 py-3 rounded-2xl text-white font-bold btn-sky disabled:opacity-40">{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
