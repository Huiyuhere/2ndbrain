// Projects — Gantt chart with task bars, dependency arrows, inline milestones
// Max 3 active projects, 2-month cap per project

import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useApp } from '@/contexts/AppContext';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import GoalBanner from '@/components/GoalBanner';

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
  taskId?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#E67E22','#2E8B57'];
const EMOJI_OPTIONS = ['📁','🚀','💎','📱','🌐','🧠','🎯','📚','💪','🎨','🌿','💰','🏆','⚡','🔥'];
const TASK_COLORS = ['#2E86C1','#F0B429','#4A7C59','#C4A882','#C0392B','#6B5EA8','#E67E22'];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function today(): string {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgt.toISOString().split('T')[0];
}

function maxEndDate(startDate: string): string {
  return addDays(startDate, 61); // ~2 months
}

// ─── Gantt helpers ────────────────────────────────────────────────────────────

/** Returns [left%, width%] for a bar spanning startDate→endDate within the project window */
function barGeometry(
  startDate: string,
  endDate: string,
  projectStart: string,
  totalDays: number
): [number, number] {
  const startOffset = Math.max(daysBetween(projectStart, startDate), 0);
  const rawEnd = Math.min(daysBetween(projectStart, endDate), totalDays);
  const clampedStart = Math.min(startOffset, totalDays);
  const width = Math.max(rawEnd - clampedStart, 0.5);
  return [(clampedStart / totalDays) * 100, (width / totalDays) * 100];
}

/** Centre-x% for a single date within the project window */
function dateLeft(dateStr: string, projectStart: string, totalDays: number): number {
  const offset = daysBetween(projectStart, dateStr);
  return Math.max(0, Math.min((offset / totalDays) * 100, 100));
}

// ─── SVG Dependency Arrows ────────────────────────────────────────────────────

type RowGeometry = {
  taskId: string;
  /** right edge x% of the bar (end of the "from" task) */
  rightPct: number;
  /** left edge x% of the bar (start of the "to" task) */
  leftPct: number;
  /** row index (0-based) */
  rowIndex: number;
};

function DependencyArrows({
  rows,
  tasks,
  projectStart,
  totalDays,
  rowHeight,
}: {
  rows: ProjectTask[];
  tasks: ProjectTask[];
  projectStart: string;
  totalDays: number;
  rowHeight: number;
}) {
  // Build a map of taskId → row geometry
  const geomMap = new Map<string, RowGeometry>();
  rows.forEach((t, i) => {
    const [left, width] = barGeometry(t.startDate, t.dueDate, projectStart, totalDays);
    geomMap.set(t.id, {
      taskId: t.id,
      rightPct: left + width,
      leftPct: left,
      rowIndex: i,
    });
  });

  const arrows: React.ReactNode[] = [];

  rows.forEach((toTask) => {
    if (!toTask.dependsOn?.length) return;
    toTask.dependsOn.forEach((fromId) => {
      const from = geomMap.get(fromId);
      const to = geomMap.get(toTask.id);
      if (!from || !to) return;

      // SVG coordinate space: 100 units wide, rowHeight*rows tall
      const totalRows = rows.length;
      const svgH = rowHeight * totalRows;

      const x1 = from.rightPct; // % → we'll use viewBox 0-100
      const y1 = (from.rowIndex + 0.5) * rowHeight;
      const x2 = to.leftPct;
      const y2 = (to.rowIndex + 0.5) * rowHeight;

      // Elbow path: right from x1, then down/up, then right to x2
      const midX = x1 + (x2 - x1) / 2;
      const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

      arrows.push(
        <g key={`${fromId}-${toTask.id}`}>
          <path
            d={d}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            opacity="0.55"
          />
          {/* Arrowhead */}
          <polygon
            points={`${x2},${y2} ${x2 - 1.5},${y2 - 1} ${x2 - 1.5},${y2 + 1}`}
            fill="var(--muted-foreground)"
            opacity="0.55"
          />
        </g>
      );
    });
  });

  if (arrows.length === 0) return null;

  const svgH = rowHeight * rows.length;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      viewBox={`0 0 100 ${svgH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%' }}
    >
      {arrows}
    </svg>
  );
}

// ─── Gantt Row ────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44; // px per task row

function GanttRow({
  task,
  inlineMilestones,
  projectStart,
  totalDays,
  todayLeft,
  todayVisible,
  onEdit,
  onDelete,
  onToggleMilestone,
  onDeleteMilestone,
  boardTaskTitle,
}: {
  task: ProjectTask;
  inlineMilestones: Milestone[];
  projectStart: string;
  totalDays: number;
  todayLeft: number;
  todayVisible: boolean;
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  onToggleMilestone: (m: Milestone) => void;
  onDeleteMilestone: (id: string) => void;
  boardTaskTitle?: string;
}) {
  const [left, width] = barGeometry(task.startDate, task.dueDate, projectStart, totalDays);

  // Status styling
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  const barBg = isDone
    ? '#4A7C59'
    : isInProgress
    ? task.color ?? '#2E86C1'
    : (task.color ?? '#2E86C1') + 'bb';

  return (
    <div className="flex items-center border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/20 transition-colors group/row" style={{ height: ROW_HEIGHT }}>
      {/* Label column */}
      <div className="w-36 shrink-0 px-3 flex flex-col justify-center gap-0.5">
        <span className="text-xs font-semibold text-[var(--foreground)] truncate leading-tight" title={task.title}>
          {isDone ? '✓ ' : isInProgress ? '▶ ' : ''}{task.title}
        </span>
        {boardTaskTitle && (
          <span className="text-[9px] text-[var(--muted-foreground)] truncate flex items-center gap-0.5">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {boardTaskTitle}
          </span>
        )}
      </div>

      {/* Timeline area */}
      <div className="flex-1 relative" style={{ height: ROW_HEIGHT }}>
        {/* Today line */}
        {todayVisible && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--sky)] z-10 opacity-50"
            style={{ left: `${todayLeft}%` }}
          />
        )}

        {/* Task bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full flex items-center px-2.5 cursor-pointer transition-all hover:brightness-110 hover:shadow-sm"
          style={{
            left: `${left}%`,
            width: `${Math.max(width, 1.5)}%`,
            background: barBg,
            minWidth: 28,
          }}
          onClick={() => onEdit(task)}
          title={`${task.title} · ${formatDateShort(task.startDate)} – ${formatDateShort(task.dueDate)}`}
        >
          <span className="text-white text-[10px] font-semibold truncate leading-none select-none">
            {task.title}
          </span>
        </div>

        {/* Inline milestones tied to this task */}
        {inlineMilestones.map(m => {
          const ml = dateLeft(m.date, projectStart, totalDays);
          return (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 z-30 group/ms flex flex-col items-center"
              style={{ left: `${ml}%`, transform: 'translate(-50%, -50%)' }}
            >
              <button
                onClick={() => onToggleMilestone(m)}
                title={`${m.title} · ${formatDateShort(m.date)}`}
                className={`w-3.5 h-3.5 rotate-45 border-2 transition-all ${
                  m.reached
                    ? 'bg-[var(--gold)] border-[var(--gold)]'
                    : 'bg-white border-[var(--muted-foreground)]'
                }`}
              />
              <span className="absolute top-full mt-0.5 text-[8px] text-[var(--muted-foreground)] whitespace-nowrap pointer-events-none">
                {m.title}
              </span>
              <button
                className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full bg-red-400 text-white text-[8px] hidden group-hover/ms:flex items-center justify-center z-40"
                onClick={e => { e.stopPropagation(); onDeleteMilestone(m.id); }}
              >×</button>
            </div>
          );
        })}

        {/* Edit / delete — appear on row hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity z-30">
          <button
            onClick={() => onEdit(task)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-all"
            title="Edit task"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-sm leading-none"
            title="Delete task"
          >×</button>
        </div>
      </div>
    </div>
  );
}

// ─── Milestones-only row (unlinked milestones) ────────────────────────────────

function MilestonesRow({
  milestones,
  projectStart,
  totalDays,
  todayLeft,
  todayVisible,
  onToggle,
  onDelete,
}: {
  milestones: Milestone[];
  projectStart: string;
  totalDays: number;
  todayLeft: number;
  todayVisible: boolean;
  onToggle: (m: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  if (milestones.length === 0) return null;
  return (
    <div className="flex items-center border-b border-[var(--border)] last:border-0" style={{ height: ROW_HEIGHT }}>
      <div className="w-36 shrink-0 px-3 text-xs text-[var(--muted-foreground)] font-medium">Milestones</div>
      <div className="flex-1 relative" style={{ height: ROW_HEIGHT }}>
        {todayVisible && (
          <div className="absolute top-0 bottom-0 w-px bg-[var(--sky)] z-10 opacity-50" style={{ left: `${todayLeft}%` }} />
        )}
        {milestones.map(m => {
          const ml = dateLeft(m.date, projectStart, totalDays);
          return (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 z-20 group/ms flex flex-col items-center"
              style={{ left: `${ml}%`, transform: 'translate(-50%, -50%)' }}
            >
              <button
                onClick={() => onToggle(m)}
                title={`${m.title} · ${formatDateShort(m.date)}`}
                className={`w-4 h-4 rotate-45 border-2 transition-all ${
                  m.reached
                    ? 'bg-[var(--gold)] border-[var(--gold)]'
                    : 'bg-white border-[var(--muted-foreground)]'
                }`}
              />
              <span className="absolute top-full mt-0.5 text-[9px] text-[var(--muted-foreground)] whitespace-nowrap pointer-events-none">
                {m.title}
              </span>
              <button
                className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full bg-red-400 text-white text-[8px] hidden group-hover/ms:flex items-center justify-center z-30"
                onClick={e => { e.stopPropagation(); onDelete(m.id); }}
              >×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

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
  const todayLeftPct = Math.max(0, Math.min((todayOffset / totalDays) * 100, 100));
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;

  // Sort tasks by earliest due date (ascending) — earliest at top
  const sortedTasks = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Partition milestones: linked to a task vs standalone
  const linkedMilestoneMap = new Map<string, Milestone[]>();
  const standaloneMilestones: Milestone[] = [];
  milestones.forEach(m => {
    if (m.taskId) {
      const arr = linkedMilestoneMap.get(m.taskId) ?? [];
      arr.push(m);
      linkedMilestoneMap.set(m.taskId, arr);
    } else {
      standaloneMilestones.push(m);
    }
  });

  // Build day-label ticks for the header (~6 evenly spaced)
  const TICK_COUNT = 5;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
    label: formatDateShort(addDays(project.startDate, Math.round((i / TICK_COUNT) * totalDays))),
    left: (i / TICK_COUNT) * 100,
  }));

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const daysLeft = daysBetween(today(), project.endDate);

  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden mb-4">
      {/* ── Project header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: project.color + '22' }}
        >
          {project.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--foreground)] truncate">{project.title}</p>
            {project.status === 'completed' && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Done</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-all"
            title="Edit project"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button
            onClick={() => onDeleteProject(project.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-50 transition-all text-base leading-none"
            title="Delete project"
          >×</button>
        </div>
      </div>

      {/* ── Gantt ── */}
      {(sortedTasks.length > 0 || milestones.length > 0) ? (
        <div className="overflow-x-auto">
          {/* Timeline header */}
          <div className="flex border-b border-[var(--border)] bg-[var(--muted)]/40 sticky top-0 z-10">
            <div className="w-36 shrink-0 px-3 py-1.5 text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Task</div>
            <div className="flex-1 relative h-7">
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-[var(--muted-foreground)] -translate-x-1/2 top-1.5"
                  style={{ left: `${tick.left}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </div>

          {/* Rows + dependency SVG overlay */}
          <div className="relative">
            {/* Dependency arrows drawn over the entire row stack */}
            {sortedTasks.length > 1 && (
              <div
                className="absolute inset-0 pointer-events-none z-20"
                style={{ left: 144 /* w-36 = 144px */ }}
              >
                <DependencyArrows
                  rows={sortedTasks}
                  tasks={sortedTasks}
                  projectStart={project.startDate}
                  totalDays={totalDays}
                  rowHeight={ROW_HEIGHT}
                />
              </div>
            )}

            {sortedTasks.map(task => (
              <GanttRow
                key={task.id}
                task={task}
                inlineMilestones={linkedMilestoneMap.get(task.id) ?? []}
                projectStart={project.startDate}
                totalDays={totalDays}
                todayLeft={todayLeftPct}
                todayVisible={todayVisible}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleMilestone={onToggleMilestone}
                onDeleteMilestone={onDeleteMilestone}
                boardTaskTitle={boardTasks.find(bt => bt.id === task.boardTaskId)?.title}
              />
            ))}

            {/* Standalone milestones row */}
            <MilestonesRow
              milestones={standaloneMilestones}
              projectStart={project.startDate}
              totalDays={totalDays}
              todayLeft={todayLeftPct}
              todayVisible={todayVisible}
              onToggle={onToggleMilestone}
              onDelete={onDeleteMilestone}
            />
          </div>

          {/* Progress bar */}
          {tasks.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/20">
              <div className="flex items-center gap-2 ml-36">
                <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: project.color }}
                  />
                </div>
                <span className="text-[10px] text-[var(--muted-foreground)] font-medium shrink-0">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
          No tasks yet — add one below
        </div>
      )}

      {/* Add buttons */}
      {project.status === 'active' && (
        <div className="flex gap-4 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={() => onAddTask(project.id)}
            className="text-xs text-[var(--sky)] font-semibold hover:underline"
          >
            + Add task
          </button>
          <button
            onClick={() => onAddMilestone(project.id)}
            className="text-xs text-[var(--gold)] font-semibold hover:underline"
          >
            ◆ Add milestone
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const { state, addTask: addBoardTask } = useApp();

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
    taskId: (m as { taskId?: string | null }).taskId ?? null,
  }));

  function getTasksForProject(projectId: string): ProjectTask[] {
    return allTasks.filter(t => t.projectId === projectId);
  }

  function getMilestonesForProject(projectId: string): Milestone[] {
    return allMilestones.filter(m => m.projectId === projectId);
  }

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
    dependsOn: [] as string[],
  });

  function openAddTask(projectId: string) {
    const proj = projects.find(p => p.id === projectId);
    setTForm({
      title: '', startDate: proj?.startDate ?? today(),
      dueDate: addDays(proj?.startDate ?? today(), 7),
      status: 'todo', color: '#2E86C1', boardTaskId: '', notes: '',
      createBoardTask: true, dependsOn: [],
    });
    setTaskModal({ open: true, projectId });
  }

  function openEditTask(t: ProjectTask) {
    setTForm({
      title: t.title, startDate: t.startDate, dueDate: t.dueDate,
      status: t.status, color: t.color ?? '#2E86C1',
      boardTaskId: t.boardTaskId ?? '', notes: t.notes ?? '',
      createBoardTask: false,
      dependsOn: t.dependsOn ?? [],
    });
    setTaskModal({ open: true, projectId: t.projectId, editing: t });
  }

  function handleSaveTask() {
    if (!tForm.title.trim()) { toast.error('Task title is required'); return; }
    const projectId = taskModal.projectId!;
    const id = taskModal.editing?.id ?? nanoid();

    let boardTaskId = tForm.boardTaskId || undefined;

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
      dependsOn: tForm.dependsOn.length > 0 ? tForm.dependsOn : undefined,
    });
    setTaskModal({ open: false });
  }

  function handleDeleteTask(id: string) {
    setDeleteConfirm({ type: 'task', id });
  }

  // ── Milestone form ──────────────────────────────────────────────────────────
  const [mForm, setMForm] = useState({ title: '', date: today(), taskId: '' });

  function openAddMilestone(projectId: string) {
    setMForm({ title: '', date: today(), taskId: '' });
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
      taskId: mForm.taskId || null,
    });
    setMilestoneModal({ open: false });
  }

  function handleToggleMilestone(m: Milestone) {
    upsertMilestoneMut.mutate({ ...m, reached: !m.reached, taskId: m.taskId ?? null });
  }

  function handleDeleteMilestone(id: string) {
    deleteMilestoneMut.mutate({ id });
  }

  const canAddProject = activeProjects.length < 3;

  // Tasks available for dependency linking (within the same project)
  function getProjectTasksForModal(): ProjectTask[] {
    if (!taskModal.projectId) return [];
    return allTasks.filter(t => t.projectId === taskModal.projectId && t.id !== taskModal.editing?.id);
  }

  // Tasks available for milestone linking (within the same project)
  function getProjectTasksForMilestone(): ProjectTask[] {
    if (!milestoneModal.projectId) return [];
    return allTasks.filter(t => t.projectId === milestoneModal.projectId);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pb-8">
      {/* Topbar */}
      <div className="topbar">
        <div className="flex items-center gap-3">
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

      {/* Quarterly focus banner */}
      <GoalBanner compact />

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

        {/* Legend */}
        {projects.length > 0 && (
          <div className="flex items-center gap-4 text-[10px] text-[var(--muted-foreground)] mb-3">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[var(--sky)]" />In progress</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#4A7C59]" />Done</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rotate-45 rounded-sm bg-[var(--gold)]" />Milestone</div>
            <div className="flex items-center gap-1"><div className="w-px h-3 bg-[var(--sky)]" />Today</div>
            <div className="flex items-center gap-1">
              <svg width="18" height="8" viewBox="0 0 18 8"><path d="M0 4 C5 4, 13 4, 16 4" fill="none" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"/><polygon points="16,4 13.5,3 13.5,5" fill="var(--muted-foreground)" opacity="0.7"/></svg>
              Dependency
            </div>
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

            <div className="flex gap-2">
              <div className="w-11 h-11 rounded-xl border-2 border-[var(--border)] text-xl flex items-center justify-center shrink-0">
                {pForm.emoji}
              </div>
              <input
                className="input-field flex-1"
                placeholder="Project title"
                value={pForm.title}
                onChange={e => setPForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

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
              <button onClick={() => setProjectModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">Cancel</button>
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

            {/* Dependencies */}
            {getProjectTasksForModal().length > 0 && (
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Depends on (blocks this task)</label>
                <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                  {getProjectTasksForModal().map(t => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={tForm.dependsOn.includes(t.id)}
                        onChange={e => {
                          setTForm(f => ({
                            ...f,
                            dependsOn: e.target.checked
                              ? [...f.dependsOn, t.id]
                              : f.dependsOn.filter(id => id !== t.id),
                          }));
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-[var(--foreground)] truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
              <button onClick={() => setTaskModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">Cancel</button>
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

            {/* Link to task (optional) */}
            {getProjectTasksForMilestone().length > 0 && (
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Link to task row (optional)</label>
                <select
                  className="input-field mt-1"
                  value={mForm.taskId}
                  onChange={e => setMForm(f => ({ ...f, taskId: e.target.value }))}
                >
                  <option value="">— Standalone (Milestones row) —</option>
                  {getProjectTasksForMilestone().map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Linked milestones appear inline on the task's row</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setMilestoneModal({ open: false })} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">Cancel</button>
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
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
