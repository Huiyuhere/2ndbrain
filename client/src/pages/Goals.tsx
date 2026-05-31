import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Goal } from '@/lib/store';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

const EMOJI_OPTIONS = ['🎯','🚀','📱','📚','💪','🌐','🧠','💡','🏆','🎨','🌿','💰','🏃','✍️','🎵'];
const COLOR_OPTIONS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#2E8B57','#E67E22'];

type GoalForm = { title: string; emoji: string; target: string; current: string; progress: number };
const EMPTY_FORM: GoalForm = { title: '', emoji: '🎯', target: '', current: '', progress: 0 };

export default function Goals() {
  const { state, updateQuarterlyGoal, addGoal, updateGoal, deleteGoal } = useApp();
  const [monthlyIntention, setMonthlyIntention] = useState('Build the Type platform MVP and hit 100 sign-ups.');
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [editingQGoal, setEditingQGoal] = useState(false);
  const [qGoalText, setQGoalText] = useState(state.quarterlyGoal.text);
  const [qProgress, setQProgress] = useState(state.quarterlyGoal.progress);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalForm>(EMPTY_FORM);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleAdd() {
    if (!form.title.trim()) return;
    addGoal({
      title: form.title.trim(),
      categoryId: 'work',
      progress: form.progress,
      target: form.target || undefined,
      current: form.current || undefined,
    });
    toast.success(`Goal "${form.title.trim()}" added!`);
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  function openEdit(g: Goal) {
    setEditId(g.id);
    setEditForm({ title: g.title, emoji: '🎯', target: g.target || '', current: g.current || '', progress: g.progress });
  }

  function handleEdit() {
    if (!editId || !editForm.title.trim()) return;
    updateGoal(editId, {
      title: editForm.title.trim(),
      progress: editForm.progress,
      target: editForm.target || undefined,
      current: editForm.current || undefined,
    });
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

  function saveQGoal() {
    updateQuarterlyGoal({ text: qGoalText, progress: qProgress });
    setEditingQGoal(false);
    toast.success('Q2 goal updated!');
  }

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
            className="text-white/70 hover:text-white text-xs shrink-0 mt-1 transition-colors"
          >
            {editingQGoal ? '✓ Save' : '✏️'}
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

      {/* MONTHLY INTENTION */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">🌙 May Intention</p>
          <button
            onClick={() => { if (editingMonthly) toast.success('Intention saved!'); setEditingMonthly(e => !e); }}
            className="text-xs text-[var(--sky)] font-medium"
          >
            {editingMonthly ? '✓ Save' : '✏️ Edit'}
          </button>
        </div>
        {editingMonthly ? (
          <textarea
            className="input-field resize-none"
            rows={2}
            value={monthlyIntention}
            onChange={e => setMonthlyIntention(e.target.value)}
          />
        ) : (
          <p className="text-sm text-[var(--foreground)] font-['Playfair_Display'] italic leading-relaxed">{monthlyIntention}</p>
        )}
      </div>

      {/* CUSTOM GOALS */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">🎯 Custom Goals</div>
        <span className="section-hdr-action cursor-pointer" onClick={() => setAddOpen(true)}>+ Add</span>
      </div>
      <div className="px-4 space-y-3">
        {state.goals.map(g => (
          <div key={g.id} className="p-4 rounded-2xl border border-[var(--border)] bg-white">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)] leading-snug flex-1">{g.title}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(g)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-all text-sm"
                    >✏️</button>
                    <button
                      onClick={() => setDeleteId(g.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-sm"
                    >×</button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{g.current || '—'} / {g.target || '—'}</span>
                  <span className="text-xs font-bold text-[var(--sky)]">{g.progress}%</span>
                </div>
                <div className="mt-2 w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${g.progress}%`, background: 'linear-gradient(90deg, #2E86C1, #5DADE2)' }} />
                </div>
                {/* Progress edit slider */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--muted-foreground)]">Progress</span>
                  <input
                    type="range" min={0} max={100} value={g.progress}
                    onChange={e => updateGoal(g.id, { progress: Number(e.target.value) })}
                    className="flex-1 accent-[#2E86C1]"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        {state.goals.length === 0 && (
          <div className="text-center py-8 text-[var(--muted-foreground)]">
            <p className="text-2xl mb-2">🎯</p>
            <p className="text-sm">No goals yet. Add your first one!</p>
          </div>
        )}
      </div>

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

function GoalModal({ title, form, setForm, onSave, onClose, saveLabel }: {
  title: string;
  form: { title: string; emoji: string; target: string; current: string; progress: number };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; emoji: string; target: string; current: string; progress: number }>>;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}) {
  const EMOJI_OPTIONS = ['🎯','🚀','📱','📚','💪','🌐','🧠','💡','🏆','🎨','🌿','💰','🏃','✍️','🎵'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] mx-4 bg-white rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <h3 className="font-['Playfair_Display'] font-bold text-lg mb-4">{title}</h3>

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

        <div className="mb-3">
          <p className="text-sm font-semibold mb-1">Goal title *</p>
          <input
            className="input-field"
            placeholder="e.g. Grow TikTok to 10K"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </div>

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">Current</p>
            <input className="input-field" placeholder="e.g. 2,400" value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">Target</p>
            <input className="input-field" placeholder="e.g. 10,000" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold mb-1">Progress: {form.progress}%</p>
          <input
            type="range" min={0} max={100} value={form.progress}
            onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
            className="w-full accent-[#2E86C1]"
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
