// Projects — Gantt chart with tasks, milestones, board auto-linking
// Max 3 active projects, 2-month cap per project

import { useState, useMemo, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useApp } from '@/contexts/AppContext';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'archived';
  description?: string | null;
};

type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  startDate: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'done';
  boardTaskId?: string | null;
  dependsOn?: string[] | null;
  color?: string | null;
  notes?: string | null;
};

type Milestone = {
  id: string;
  projectId: string;
  title: string;
  date: string;
  reached: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#E67E22','#2E8B57'];
const EMOJI_OPTIONS = ['📁','🚀','💎','📱','🌐','🧠','🎯','📚','💪','🎨','🌿','💰','🏆','⚡','🔥'];
const TASK_COLORS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#E67E22'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function maxEndDate(startDate: string): string {
  return addDays(startDate, 61); // ~2 months
}

// ─── Gantt Row Component ──────────────────────────────────────────────────────

function GanttBar({
  task,
  projectStart,
  totalDays,
  onEdit,
  onDelete,
  boardTaskTitle,
}: {
  task: ProjectTask;
  projectStart: string;
  totalDays: number;
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  boardTaskTitle?: string;
}) {
  const startOffset = Math.max(daysBetween(projectStart, task.startDate), 0);
  const duration = Math.max(daysBetween(task.startDate, task.dueDate), 1);
  const left = (startOffset / totalDays) * 100;
  const width = Math.min((duration / totalDays) * 100, 100 - left);

  const statusAlpha = task.status === 'done' ? '99' : task.status === 'in_progress' ? 'cc' : '88';
  const barColor = (task.color || '#2E86C1') + statusAlpha;

  return (
    <div className="relative h-8 flex items-center">
      {/* Bar */}
      <div
        className="absolute h-6 rounded-lg flex items-center px-2 cursor-pointer group"
        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%`, background: barColor, minWidth: 24 }}
        onClick={() => onEdit(task)}
        title={`${task.title} (${formatDateShort(task.startDate)} – ${formatDateShort(task.dueDate)})`}
      >
        <span className="text-white text-[10px] font-semibold truncate leading-none">
          {task.status === 'done' ? '✓ ' : task.status === 'in_progress' ? '▶ ' : ''}{task.title}
        </span>
        {/* Delete button on hover */}
        <button
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] hidden group-hover:flex items-center justify-center"
          onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        >×</button>
      </div>
      {/* Board link badge */}
      {boardTaskTitle && (
        <div
          className="absolute text-[9px] text-[var(--muted-foreground)] truncate"
          style={{ left: `${left}%`, top: '100%', maxWidth: `${width}%` }}
        >
          🔗 {boardTaskTitle}
        </div>
      )}
    </div>
  );
}

// ─── Milestone Marker ─────────────────────────────────────────────────────────

function MilestoneMarker({
  milestone,
  projectStart,
  totalDays,
  onToggle,
  onDelete,
}: {
  milestone: Milestone;
  projectStart: string;
  totalDays: number;
  onToggle: (m: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  const offset = daysBetween(projectStart, milestone.date);
  if (offset < 0 || offset > totalDays) return null;
  const left = (offset / totalDays) * 100;

  return (
    <div
      className="absolute flex flex-col items-center group"
      style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
    >
      <button
        onClick={() => onToggle(milestone)}
        title={`${milestone.title} — ${formatDateShort(milestone.date)}`}
        className={`w-4 h-4 rotate-45 border-2 transition-all ${
          milestone.reached
            ? 'bg-[var(--gold)] border-[var(--gold)]'
            : 'bg-white border-[var(--muted-foreground)]'
        }`}
      />
      <span className="text-[9px] text-[var(--muted-foreground)] mt-0.5 whitespace-nowrap">{milestone.title}</span>
      <button
        className="absolute -top-1 -right-3 w-3.5 h-3.5 rounded-full bg-red-400 text-white text-[8px] hidden group-hover:flex items-center justify-center"
        onClick={e => { e.stopPropagation(); onDelete(milestone.id); }}
      >×</button>
    </div>
  );
}

// ─── Project Card (Gantt view) ────────────────────────────────────────────────

function ProjectCard({
  project,
  tasks,
  milestones,
  boardTasks,
  onEditProject,
  onCompleteProject,
  onDeleteProject,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onAddMilestone,
  onToggleMilestone,
  onDeleteMilestone,
}: {
  project: Project;
  tasks: ProjectTask[];
  milestones: Milestone[];
  boardTasks: { id: string; title: string }[];
  onEditProject: (p: Project) => void;
  onCompleteProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onAddTask: (projectId: string) => void;
  onEditTask: (t: ProjectTask) => void;
  onDeleteTask: (id: string) => void;
  onAddMilestone: (projectId: string) => void;
  onToggleMilestone: (m: Milestone) => void;
  onDeleteMilestone: (id: string) => void;
}) {
  const totalDays = Math.max(daysBetween(project.startDate, project.endDate), 1);
  const todayOffset = daysBetween(project.startDate, today());
  const todayLeft = Math.max(0, Math.min((todayOffset / totalDays) * 100, 100));
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;

  // Build day labels for the header (show ~6 labels)
  const labelCount = 6;
  const dayLabels = Array.from({ length: labelCount + 1 }, (_, i) => {
    const d = addDays(project.startDate, Math.round((i / labelCount) * totalDays));
    return { label: formatDateShort(d), left: (i / labelCount) * 100 };
  });

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const daysLeft = daysBetween(today(), project.endDate);

  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: project.color + '22' }}
        >
          {project.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[var(--foreground)] truncate">{project.title}</p>
            {project.status === 'completed' && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Done</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[var(--muted-foreground)]">
              {formatDateShort(project.startDate)} – {formatDateShort(project.endDate)}
            </span>
            {daysLeft >= 0 && project.status === 'active' && (
              <span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-red-500' : 'text-[var(--muted-foreground)]'}`}>
                {daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
              </span>
            )}
            {tasks.length > 0 && (
              <span className="text-xs text-[var(--muted-foreground)]">{progress}% ({doneCount}/{tasks.length})</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {project.status === 'active' && (
            <button
              onClick={() => onCompleteProject(project)}
              className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-medium border border-green-200 hover:bg-green-100 transition-colors"
            >
              ✓ Complete
            </button>
          )}
          <button
            onClick={() => onEditProject(project)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            ✏️
          </button>
          <button
            onClick={() => onDeleteProject(project.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Gantt area */}
      <div className="px-4 pt-3 pb-4">
        {/* Timeline header */}
        <div className="relative h-5 mb-1 ml-32">
          {dayLabels.map((l, i) => (
            <span
              key={i}
              className="absolute text-[9px] text-[var(--muted-foreground)] -translate-x-1/2"
              style={{ left: `${l.left}%` }}
            >
              {l.label}
            </span>
          ))}
        </div>

        {/* Task rows */}
        {tasks.length === 0 && milestones.length === 0 ? (
          <div className="text-center py-4 text-sm text-[var(--muted-foreground)]">
            No tasks yet — add one below
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map(task => (
              <div key={task.id} className="flex items-start gap-2">
                {/* Task label */}
                <div className="w-32 shrink-0 text-xs text-[var(--foreground)] truncate pt-1 font-medium" title={task.title}>
                  {task.title}
                </div>
                {/* Bar area */}
                <div className="flex-1 relative" style={{ minHeight: 32 }}>
                  {/* Today line */}
                  {todayVisible && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60 z-10"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                  <GanttBar
                    task={task}
                    projectStart={project.startDate}
                    totalDays={totalDays}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    boardTaskTitle={boardTasks.find(bt => bt.id === task.boardTaskId)?.title}
                  />
                </div>
              </div>
            ))}

            {/* Milestones row */}
            {milestones.length > 0 && (
              <div className="flex items-start gap-2 mt-2">
                <div className="w-32 shrink-0 text-xs text-[var(--muted-foreground)] pt-1">Milestones</div>
                <div className="flex-1 relative" style={{ height: 40 }}>
                  {todayVisible && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60 z-10"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                  {milestones.map(m => (
                    <MilestoneMarker
                      key={m.id}
                      milestone={m}
                      projectStart={project.startDate}
                      totalDays={totalDays}
                      onToggle={onToggleMilestone}
                      onDelete={onDeleteMilestone}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mt-3 ml-32">
            <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: project.color }}
              />
            </div>
          </div>
        )}

        {/* Add buttons */}
        {project.status === 'active' && (
          <div className="flex gap-2 mt-3 ml-32">
            <button
              onClick={() => onAddTask(project.id)}
              className="text-xs text-[var(--sky)] font-medium hover:underline"
            >
              + Add task
            </button>
            <button
              onClick={() => onAddMilestone(project.id)}
              className="text-xs text-[var(--gold)] font-medium hover:underline"
            >
              ◆ Add milestone
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const { state, addTask: addBoardTask } = useApp();

  // ── Single combined query (avoids hooks-in-loop) ──────────────────────────────────────────
  const listAllQuery = trpc.projects.listAll.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();

  const invalidateAll = useCallback(() => utils.projects.listAll.invalidate(), [utils]);

  const upsertProject = trpc.projects.upsert.useMutation({
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message.replace('MAX_PROJECTS: ', '')),
  });
  const deleteProjectMut = trpc.projects.delete.useMutation({ onSuccess: invalidateAll });
  const upsertTaskMut = trpc.projects.upsertTask.useMutation({ onSuccess: invalidateAll });
  const deleteTaskMut = trpc.projects.deleteTask.useMutation({ onSuccess: invalidateAll });
  const upsertMilestoneMut = trpc.projects.upsertMilestone.useMutation({ onSuccess: invalidateAll });
  const deleteMilestoneMut = trpc.projects.deleteMilestone.useMutation({ onSuccess: invalidateAll });

  const rawData = listAllQuery.data;

  const projects: Project[] = (rawData?.projects ?? []).map(p => ({
    id: p.id,
    title: p.title,
    emoji: p.emoji ?? '📁',
    color: p.color ?? '#2E86C1',
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status as Project['status'],
    description: p.description,
  }));

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  const allTasks: ProjectTask[] = (rawData?.tasks ?? []).map(t => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    startDate: t.startDate,
    dueDate: t.dueDate,
    status: t.status as ProjectTask['status'],
    boardTaskId: t.boardTaskId,
    dependsOn: t.dependsOn as string[] | null,
    color: t.color,
    notes: t.notes,
  }));

  const allMilestones: Milestone[] = (rawData?.milestones ?? []).map(m => ({
    id: m.id,
    projectId: m.projectId,
    title: m.title,
    date: m.date,
    reached: m.reached,
  }));

  function getTasksForProject(projectId: string): ProjectTask[] {
    return allTasks.filter(t => t.projectId === projectId);
  }

  function getMilestonesForProject(projectId: string): Milestone[] {
    return allMilestones.filter(m => m.projectId === projectId);
  }

  // ── Board tasks for linking ─────────────────────────────────────────────────
  const boardTasks = state.tasks.map(t => ({ id: t.id, title: t.title }));

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [projectModal, setProjectModal] = useState<{ open: boolean; editing?: Project }>({ open: false });
  const [taskModal, setTaskModal] = useState<{ open: boolean; projectId?: string; editing?: ProjectTask }>({ open: false });
  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; projectId?: string }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'task'; id: string } | null>(null);

  // ── Project form ────────────────────────────────────────────────────────────
  const [pForm, setPForm] = useState({
    title: '', emoji: '📁', color: '#2E86C1',
    startDate: today(), endDate: addDays(today(), 30), description: '',
  });

  function openAddProject() {
    setPForm({ title: '', emoji: '📁', color: '#2E86C1', startDate: today(), endDate: addDays(today(), 30), description: '' });
    setProjectModal({ open: true });
  }

  function openEditProject(p: Project) {
    setPForm({ title: p.title, emoji: p.emoji, color: p.color, startDate: p.startDate, endDate: p.endDate, description: p.description ?? '' });
    setProjectModal({ open: true, editing: p });
  }

  function handleSaveProject() {
    if (!pForm.title.trim()) { toast.error('Project title is required'); return; }
    const id = projectModal.editing?.id ?? nanoid();
    upsertProject.mutate({
      id,
      title: pForm.title.trim(),
      emoji: pForm.emoji,
      color: pForm.color,
      startDate: pForm.startDate,
      endDate: pForm.endDate,
      description: pForm.description || undefined,
      status: projectModal.editing?.status ?? 'active',
    });
    setProjectModal({ open: false });
  }

  function handleCompleteProject(p: Project) {
    upsertProject.mutate({ ...p, status: 'completed', description: p.description ?? undefined });
    toast.success(`"${p.title}" marked complete 🎉`);
  }

  function handleDeleteProject(id: string) {
    setDeleteConfirm({ type: 'project', id });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'project') {
      deleteProjectMut.mutate({ id: deleteConfirm.id });
      toast.success('Project deleted');
    } else {
      deleteTaskMut.mutate({ id: deleteConfirm.id });
    }
    setDeleteConfirm(null);
  }

  // ── Task form ───────────────────────────────────────────────────────────────
  const [tForm, setTForm] = useState({
    title: '', startDate: today(), dueDate: addDays(today(), 7),
    status: 'todo' as ProjectTask['status'],
    color: '#2E86C1', boardTaskId: '', notes: '',
    createBoardTask: true,
  });

  function openAddTask(projectId: string) {
    const proj = projects.find(p => p.id === projectId);
    setTForm({
      title: '', startDate: proj?.startDate ?? today(),
      dueDate: addDays(proj?.startDate ?? today(), 7),
      status: 'todo', color: '#2E86C1', boardTaskId: '', notes: '',
      createBoardTask: true,
    });
    setTaskModal({ open: true, projectId });
  }

  function openEditTask(t: ProjectTask) {
    setTForm({
      title: t.title, startDate: t.startDate, dueDate: t.dueDate,
      status: t.status, color: t.color ?? '#2E86C1',
      boardTaskId: t.boardTaskId ?? '', notes: t.notes ?? '',
      createBoardTask: false,
    });
    setTaskModal({ open: true, projectId: t.projectId, editing: t });
  }

  function handleSaveTask() {
    if (!tForm.title.trim()) { toast.error('Task title is required'); return; }
    const projectId = taskModal.projectId!;
    const id = taskModal.editing?.id ?? nanoid();

    let boardTaskId = tForm.boardTaskId || undefined;

    // Auto-create board task if requested (new task only)
    if (!taskModal.editing && tForm.createBoardTask) {
      const newBoardTask = addBoardTask({
        title: tForm.title.trim(),
        categoryId: 'work',
        column: 'week',
        duration: undefined,
        scheduledTime: undefined,
        scheduledDate: tForm.dueDate,
        subtasks: [],
        links: [],
        notes: tForm.notes || undefined,
        completedAt: undefined,
      });
      boardTaskId = newBoardTask.id;
      toast.success('Task also added to Board → Week column');
    }

    upsertTaskMut.mutate({
      id,
      projectId,
      title: tForm.title.trim(),
      startDate: tForm.startDate,
      dueDate: tForm.dueDate,
      status: tForm.status,
      color: tForm.color,
      boardTaskId: boardTaskId ?? (tForm.boardTaskId || undefined),
      notes: tForm.notes || undefined,
    });
    setTaskModal({ open: false });
  }

  function handleDeleteTask(id: string) {
    setDeleteConfirm({ type: 'task', id });
  }

  // ── Milestone form ──────────────────────────────────────────────────────────
  const [mForm, setMForm] = useState({ title: '', date: today() });

  function openAddMilestone(projectId: string) {
    setMForm({ title: '', date: today() });
    setMilestoneModal({ open: true, projectId });
  }

  function handleSaveMilestone() {
    if (!mForm.title.trim()) { toast.error('Milestone title is required'); return; }
    upsertMilestoneMut.mutate({
      id: nanoid(),
      projectId: milestoneModal.projectId!,
      title: mForm.title.trim(),
      date: mForm.date,
      reached: false,
    });
    setMilestoneModal({ open: false });
  }

  function handleToggleMilestone(m: Milestone) {
    upsertMilestoneMut.mutate({ ...m, reached: !m.reached });
  }

  function handleDeleteMilestone(id: string) {
    deleteMilestoneMut.mutate({ id });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const canAddProject = activeProjects.length < 3;

  return (
    <div className="pb-8">
      {/* Topbar */}
      <div className="topbar">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="topbar-title">🗂️ Projects</h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeProjects.length}/3 active · Gantt view
            </p>
          </div>
        </div>
        <button
          onClick={openAddProject}
          disabled={!canAddProject}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
            canAddProject
              ? 'btn-sky text-white'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
          }`}
          title={!canAddProject ? 'Complete a project to add a new one' : undefined}
        >
          + Project
        </button>
      </div>

      <div className="px-4 mt-4">
        {/* Capacity notice */}
        {!canAddProject && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>3 active projects running.</strong> Complete one before starting another — focus beats multitasking.
          </div>
        )}

        {/* Loading */}
        {listAllQuery.isLoading && (
          <div className="text-center py-12 text-[var(--muted-foreground)]">Loading projects…</div>
        )}

        {/* Empty state */}
        {!listAllQuery.isLoading && projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="font-semibold text-[var(--foreground)] mb-1">No projects yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Create up to 3 focused projects (max 2 months each)
            </p>
            <button onClick={openAddProject} className="btn-sky px-5 py-2.5 rounded-xl text-sm font-semibold text-white">
              + New Project
            </button>
          </div>
        )}

        {/* Active projects */}
        {activeProjects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            tasks={getTasksForProject(project.id)}
            milestones={getMilestonesForProject(project.id)}
            boardTasks={boardTasks}
            onEditProject={openEditProject}
            onCompleteProject={handleCompleteProject}
            onDeleteProject={handleDeleteProject}
            onAddTask={openAddTask}
            onEditTask={openEditTask}
            onDeleteTask={handleDeleteTask}
            onAddMilestone={openAddMilestone}
            onToggleMilestone={handleToggleMilestone}
            onDeleteMilestone={handleDeleteMilestone}
          />
        ))}

        {/* Completed projects (collapsed) */}
        {completedProjects.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm text-[var(--muted-foreground)] cursor-pointer select-none py-2 font-medium">
              ✓ {completedProjects.length} completed project{completedProjects.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 opacity-60">
              {completedProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  tasks={getTasksForProject(project.id)}
                  milestones={getMilestonesForProject(project.id)}
                  boardTasks={boardTasks}
                  onEditProject={openEditProject}
                  onCompleteProject={handleCompleteProject}
                  onDeleteProject={handleDeleteProject}
                  onAddTask={openAddTask}
                  onEditTask={openEditTask}
                  onDeleteTask={handleDeleteTask}
                  onAddMilestone={openAddMilestone}
                  onToggleMilestone={handleToggleMilestone}
                  onDeleteMilestone={handleDeleteMilestone}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Project Modal ─────────────────────────────────────────────────────── */}
      {projectModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setProjectModal({ open: false })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{projectModal.editing ? 'Edit Project' : 'New Project'}</h2>

            {/* Emoji + Title */}
            <div className="flex gap-2">
              <div className="relative">
                <button
                  className="w-11 h-11 rounded-xl border-2 border-[var(--border)] text-xl flex items-center justify-center"
                  onClick={() => {/* cycle emoji */}}
                >
                  {pForm.emoji}
                </button>
              </div>
              <input
                className="input-field flex-1"
                placeholder="Project title"
                value={pForm.title}
                onChange={e => setPForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Emoji picker */}
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setPForm(f => ({ ...f, emoji: e }))}
                  className={`w-9 h-9 rounded-lg text-lg border-2 transition-all ${pForm.emoji === e ? 'border-[var(--sky)] bg-[var(--sky-mist)]' : 'border-[var(--border)]'}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Color</label>
              <div className="flex gap-2 mt-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setPForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${pForm.color === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Start date</label>
                <input
                  type="date"
                  className="input-field mt-1"
                  value={pForm.startDate}
                  onChange={e => {
                    const s = e.target.value;
                    setPForm(f => ({ ...f, startDate: s, endDate: addDays(s, 30) }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">End date</label>
                <input
                  type="date"
                  className="input-field mt-1"
                  value={pForm.endDate}
                  min={pForm.startDate}
                  max={maxEndDate(pForm.startDate)}
                  onChange={e => setPForm(f => ({ ...f, endDate: e.target.value }))}
                />
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Max 2 months from start</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Description (optional)</label>
              <textarea
                className="input-field mt-1 resize-none min-h-[60px]"
                placeholder="What is this project about?"
                value={pForm.description}
                onChange={e => setPForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setProjectModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleSaveProject} className="flex-1 py-3 rounded-xl btn-sky text-white text-sm font-semibold">
                {projectModal.editing ? 'Save' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Modal ────────────────────────────────────────────────────────── */}
      {taskModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setTaskModal({ open: false })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{taskModal.editing ? 'Edit Task' : 'Add Task'}</h2>

            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Task title</label>
              <input
                className="input-field mt-1"
                placeholder="What needs to be done?"
                value={tForm.title}
                onChange={e => setTForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Start</label>
                <input type="date" className="input-field mt-1" value={tForm.startDate} onChange={e => setTForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Due</label>
                <input type="date" className="input-field mt-1" value={tForm.dueDate} min={tForm.startDate} onChange={e => setTForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Status</label>
              <div className="flex gap-2 mt-1.5">
                {(['todo', 'in_progress', 'done'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setTForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      tForm.status === s ? 'border-transparent btn-sky' : 'border-[var(--border)] text-[var(--muted-foreground)]'
                    }`}
                  >
                    {s === 'todo' ? '○ Todo' : s === 'in_progress' ? '▶ In Progress' : '✓ Done'}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Bar color</label>
              <div className="flex gap-2 mt-1.5">
                {TASK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setTForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${tForm.color === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Board task link */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Link to board task</label>
              <select
                className="input-field mt-1"
                value={tForm.boardTaskId}
                onChange={e => setTForm(f => ({ ...f, boardTaskId: e.target.value, createBoardTask: false }))}
              >
                <option value="">— None —</option>
                {boardTasks.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.title}</option>
                ))}
              </select>
            </div>

            {/* Auto-create board task toggle (new tasks only) */}
            {!taskModal.editing && !tForm.boardTaskId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tForm.createBoardTask}
                  onChange={e => setTForm(f => ({ ...f, createBoardTask: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[var(--foreground)]">Auto-add to Board (Week column)</span>
              </label>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Notes</label>
              <textarea
                className="input-field mt-1 resize-none min-h-[60px]"
                placeholder="Any context or details…"
                value={tForm.notes}
                onChange={e => setTForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setTaskModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleSaveTask} className="flex-1 py-3 rounded-xl btn-sky text-white text-sm font-semibold">
                {taskModal.editing ? 'Save' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Milestone Modal ───────────────────────────────────────────────────── */}
      {milestoneModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setMilestoneModal({ open: false })}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">◆ Add Milestone</h2>
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Milestone name</label>
              <input
                className="input-field mt-1"
                placeholder="e.g. Beta launch"
                value={mForm.title}
                onChange={e => setMForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Date</label>
              <input type="date" className="input-field mt-1" value={mForm.date} onChange={e => setMForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setMilestoneModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleSaveMilestone} className="flex-1 py-3 rounded-xl btn-sky text-white text-sm font-semibold">
                Add Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Delete {deleteConfirm.type}?</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {deleteConfirm.type === 'project'
                ? 'This will also delete all tasks and milestones in this project.'
                : 'This removes the task from the Gantt. The linked board task (if any) is kept.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">
                Cancel
              </button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
