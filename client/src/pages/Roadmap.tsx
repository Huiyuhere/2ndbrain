import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RoadmapProject } from '@/lib/store';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TODAY_MONTH = new Date().getMonth(); // live current month

const COLOR_OPTIONS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#2E8B57','#E67E22'];
const EMOJI_OPTIONS = ['💎','📱','🌐','🧠','🚀','🎯','📚','💪','🎨','🌿','💰','🏆'];

type ProjectForm = {
  name: string;
  emoji: string;
  color: string;
  startMonth: number;
  endMonth: number;
  progress: number;
};

const EMPTY_FORM: ProjectForm = { name: '', emoji: '🚀', color: '#2E86C1', startMonth: 0, endMonth: 5, progress: 0 };

export default function Roadmap() {
  const { state, addProject, updateProject, deleteProject } = useApp();
  const projects = state.roadmapProjects || [];
  const [view, setView] = useState<'year' | 'q'>('q');

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectForm>(EMPTY_FORM);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Q2 = Apr(3), May(4), Jun(5)
  const Q_START = 3; const Q_END = 5;
  const visibleMonths = view === 'year' ? MONTHS : MONTHS.slice(Q_START, Q_END + 1);
  const startOffset = view === 'year' ? 0 : Q_START;
  const totalMonths = visibleMonths.length;

  function getBarStyle(p: RoadmapProject) {
    const start = Math.max(p.startMonth - startOffset, 0);
    const end = Math.min(p.endMonth - startOffset, totalMonths - 1);
    if (start > totalMonths - 1 || end < 0) return null;
    const left = (start / totalMonths) * 100;
    const width = ((end - start + 1) / totalMonths) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }

  function getMilestoneLeft(month: number) {
    const rel = month - startOffset;
    if (rel < 0 || rel > totalMonths - 1) return null;
    return `${((rel + 0.5) / totalMonths) * 100}%`;
  }

  const todayLeft = `${((TODAY_MONTH - startOffset + 0.5) / totalMonths) * 100}%`;
  const todayVisible = TODAY_MONTH >= startOffset && TODAY_MONTH < startOffset + totalMonths;

  function handleAdd() {
    if (!form.name.trim()) return;
    addProject({ ...form, name: form.name.trim(), milestones: [] });
    toast.success(`Project "${form.name.trim()}" added!`);
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  function openEdit(p: RoadmapProject) {
    setEditId(p.id);
    setEditForm({ name: p.name, emoji: p.emoji, color: p.color, startMonth: p.startMonth, endMonth: p.endMonth, progress: p.progress });
  }

  function handleEdit() {
    if (!editId || !editForm.name.trim()) return;
    updateProject(editId, { ...editForm, name: editForm.name.trim() });
    toast.success('Project updated!');
    setEditId(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    const p = projects.find(p => p.id === deleteId);
    deleteProject(deleteId);
    toast.success(`Project "${p?.name}" deleted`);
    setDeleteId(null);
  }

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">🏔️ Roadmap</div>
          <div className="topbar-sub">2026 Timeline</div>
        </div>
        <button onClick={() => setAddOpen(true)} className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky">+ Project</button>
      </div>

      {/* VIEW TOGGLE */}
      <div className="px-4 mt-2">
        <div className="tab-switcher">
          <button className={`tab-btn ${view === 'q' ? 'active' : ''}`} onClick={() => setView('q')}>🎯 Q2 Focus</button>
          <button className={`tab-btn ${view === 'year' ? 'active' : ''}`} onClick={() => setView('year')}>📅 Full Year</button>
        </div>
      </div>

      {/* GANTT CHART — light background */}
      <div className="mx-4 mt-2 bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
        {/* Month headers */}
        <div className="flex border-b border-[var(--border)] bg-[var(--muted)]">
          <div className="w-28 shrink-0 px-3 py-2 text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Project</div>
          <div className="flex-1 flex">
            {visibleMonths.map((m, i) => {
              const absMonth = i + startOffset;
              const isToday = absMonth === TODAY_MONTH;
              const isPast = absMonth < TODAY_MONTH;
              return (
                <div key={i} className={`flex-1 text-center py-2 text-[10px] font-semibold ${
                  isToday ? 'text-[var(--sky)] font-bold' : isPast ? 'text-[var(--muted-foreground)] opacity-40' : 'text-[var(--muted-foreground)]'
                }`}>
                  {m}
                </div>
              );
            })}
          </div>
          {/* Edit col header */}
          <div className="w-16 shrink-0" />
        </div>

        {/* Project rows */}
        {projects.map(p => {
          const barStyle = getBarStyle(p);
          return (
            <div key={p.id} className="flex items-center border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
              <div className="w-28 shrink-0 px-3 py-3 flex items-center gap-2">
                <span className="text-base">{p.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--foreground)] truncate">{p.name}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">{p.progress}%</p>
                </div>
              </div>
              <div className="flex-1 relative py-3 pr-2" style={{ height: '52px' }}>
                {/* Today line */}
                {todayVisible && (
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--sky)] z-10 opacity-60" style={{ left: todayLeft }} />
                )}
                {/* Bar */}
                {barStyle && (
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full overflow-hidden" style={barStyle}>
                    <div className="h-full w-full opacity-15 rounded-full" style={{ background: p.color }} />
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${p.progress}%`, background: p.color }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold truncate" style={{ color: p.color }}>
                      {p.name}
                    </span>
                  </div>
                )}
                {/* Milestones */}
                {p.milestones.map((m, i) => {
                  const left = getMilestoneLeft(m.month);
                  if (!left) return null;
                  return (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 z-20 group" style={{ left }}>
                      <div className="milestone-diamond" style={{ background: '#F0B429' }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[var(--foreground)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {m.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Edit / Delete */}
              <div className="w-16 shrink-0 flex items-center justify-end gap-1 pr-2">
                <button
                  onClick={() => openEdit(p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-all"
                  title="Edit project"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  onClick={() => setDeleteId(p.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-base leading-none"
                >×</button>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="py-8 text-center text-[var(--muted-foreground)]">
            <p className="text-2xl mb-2">🏔️</p>
            <p className="text-sm">No projects yet. Add your first one!</p>
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div className="mx-4 mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--sky)]" />Progress</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rotate-45 rounded-sm" style={{ background: '#F0B429' }} />Milestone</div>
        <div className="flex items-center gap-1.5"><div className="w-px h-3 bg-[var(--sky)]" />Today</div>
      </div>

      {/* UPCOMING MILESTONES */}
      <div className="section-hdr mt-4">
        <div className="section-hdr-title">⭐ Upcoming Milestones</div>
      </div>
      <div className="px-4 space-y-2">
        {projects.flatMap(p => p.milestones.map(m => ({ ...m, project: p }))).filter(m => m.month >= TODAY_MONTH).sort((a, b) => a.month - b.month).slice(0, 4).map((m, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[var(--border)]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: m.project.color + '20' }}>
              {m.project.emoji}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">{m.label}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{m.project.name} · {MONTHS[m.month]} 2026</p>
            </div>
            <div className="w-2 h-2 rotate-45 rounded-sm" style={{ background: '#F0B429' }} />
          </div>
        ))}
        {projects.flatMap(p => p.milestones).filter(m => m.month >= TODAY_MONTH).length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-4">No upcoming milestones</p>
        )}
      </div>

      {/* ADD PROJECT MODAL */}
      {addOpen && (
        <ProjectModal
          title="Add new project"
          form={form}
          setForm={setForm}
          onSave={handleAdd}
          onClose={() => { setAddOpen(false); setForm(EMPTY_FORM); }}
          saveLabel="Add project"
        />
      )}

      {/* EDIT PROJECT MODAL */}
      {editId && (
        <ProjectModal
          title="Edit project"
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
            <h3 className="font-['Playfair_Display'] font-bold text-base mb-2">Delete this project?</h3>
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

function ProjectModal({ title, form, setForm, onSave, onClose, saveLabel }: {
  title: string;
  form: ProjectForm;
  setForm: React.Dispatch<React.SetStateAction<ProjectForm>>;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}) {
  const EMOJI_OPTIONS = ['💎','📱','🌐','🧠','🚀','🎯','📚','💪','🎨','🌿','💰','🏆'];
  const COLOR_OPTIONS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#2E8B57','#E67E22'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] mx-4 bg-white rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
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

        {/* Color */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Color</p>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full border-4 transition-all ${form.color === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-3">
          <p className="text-sm font-semibold mb-1">Project name *</p>
          <input
            className="input-field"
            placeholder="e.g. Type Platform"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>

        {/* Start / End month */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">Start month</p>
            <select
              className="input-field"
              value={form.startMonth}
              onChange={e => setForm(f => ({ ...f, startMonth: Number(e.target.value) }))}
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">End month</p>
            <select
              className="input-field"
              value={form.endMonth}
              onChange={e => setForm(f => ({ ...f, endMonth: Number(e.target.value) }))}
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Progress */}
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
          <button onClick={onSave} disabled={!form.name.trim()} className="flex-1 py-3 rounded-2xl text-white font-bold btn-sky disabled:opacity-40">{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
