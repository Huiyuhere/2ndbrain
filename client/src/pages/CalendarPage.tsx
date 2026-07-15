import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  Task, TimeBlock, getTaskMinutes, parseTitleDuration,
  getCalendarRange, blocksOnDate, tasksOnDate, minToLabel,
  getTaskType, getCategoryById, buildICS, parseDurationStr,
} from '@/lib/store';
import GoalBanner from '@/components/GoalBanner';
import TimeBlockModal, { TimeBlockDraft } from '@/components/TimeBlockModal';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const DAY_START = 6;  // 6am
const DAY_END = 22;   // 10pm (exclusive end -> last row label is 9pm)
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START);
const HOUR_PX = 60;
const PRESET_DURATIONS = ['30m', '1h', '1.5h', '2h', '3h'];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(dateStr: string, n: number): string {
  const d = parseYMD(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { state, updateTask } = useApp();

  // 13-day strip: past 2 days, today, next 10 days
  const days = useMemo(() => getCalendarRange(), []);
  const todayStr = days[2]; // index 2 is today by construction
  const [activeDateStr, setActiveDateStr] = useState(todayStr);

  const [panelOpen, setPanelOpen] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dropHour, setDropHour] = useState<number | null>(null);

  // Duration modal for scheduling tasks
  const [durationModal, setDurationModal] = useState<{ task: Task; hour: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('1h');

  // Time block modal
  const [blockDraft, setBlockDraft] = useState<TimeBlockDraft | null>(null);

  // ── Google Calendar mirror events ──────────────────────────────────────────
  const { data: gcStatus } = trpc.googleCalendar.status.useQuery();
  const gcConnected = gcStatus?.connected ?? false;

  // Fetch mirror events for the visible 13-day window
  const windowStart = days[0];
  const windowEnd = days[days.length - 1];
  const { data: mirrorEvents, refetch: refetchMirror } = trpc.googleCalendar.getMirrorEvents.useQuery(
    { startDate: windowStart, endDate: windowEnd },
    { enabled: gcConnected }
  );

  const syncMutation = trpc.googleCalendar.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.count} event${data.count === 1 ? '' : 's'} from Google Calendar`);
      refetchMirror();
    },
    onError: () => toast.error('Google Calendar sync failed'),
  });

  // Mirror events for the active date
  const dayMirrorEvents = useMemo(() => {
    if (!mirrorEvents) return [];
    return mirrorEvents.filter(e => e.date === activeDateStr && e.startMin !== null);
  }, [mirrorEvents, activeDateStr]);

  // Items on the active day (recurrence-expanded)
  const scheduledTasks = useMemo(
    () => tasksOnDate(state.tasks, activeDateStr).filter(t => t.scheduledTime),
    [state.tasks, activeDateStr],
  );
  const dayBlocks = useMemo(
    () => blocksOnDate(state.timeBlocks, activeDateStr),
    [state.timeBlocks, activeDateStr],
  );
  const unscheduled = state.tasks.filter(t => t.column !== 'done' && !t.scheduledDate);

  const activeDate = parseYMD(activeDateStr);
  const monthLabel = `${MONTHS[activeDate.getUTCMonth()]} ${activeDate.getUTCFullYear()}`;

  // ── Scheduling a dragged task: infer duration from [Xh] bracket ──
  function openDurationModal(task: Task, hour: number) {
    const { durationStr } = parseTitleDuration(task.title);
    const inferred = task.duration || durationStr; // explicit field wins, else bracket
    setSelectedDuration(inferred && parseDurationStr(inferred) > 0 ? inferred : '1h');
    setDurationModal({ task, hour });
  }

  // Chips to show: presets + the inferred one if it isn't already a preset
  const durationChips = useMemo(() => {
    const chips = [...PRESET_DURATIONS];
    if (selectedDuration && !chips.includes(selectedDuration)) chips.push(selectedDuration);
    return chips;
  }, [selectedDuration]);

  function confirmSchedule() {
    if (!durationModal) return;
    const timeStr = `${String(durationModal.hour).padStart(2, '0')}:00`;
    updateTask(durationModal.task.id, {
      scheduledDate: activeDateStr,
      scheduledTime: timeStr,
      duration: selectedDuration,
    });
    setDurationModal(null);
    toast.success(`Scheduled: ${parseTitleDuration(durationModal.task.title).cleanTitle || durationModal.task.title}`);
  }

  // ── Time block helpers ──
  function newBlockAtHour(hour: number) {
    setBlockDraft({
      date: activeDateStr,
      startMin: hour * 60,
      endMin: (hour + 1) * 60,
    });
  }
  function editBlock(b: TimeBlock) {
    setBlockDraft({
      id: b.id, date: b.date, startMin: b.startMin, endMin: b.endMin,
      title: b.title, categoryId: b.categoryId, taskType: b.taskType,
      recurFreq: b.recurFreq, recurEndDate: b.recurEndDate,
    });
  }

  function exportICS() {
    // Export the actual stored items (anchors); recurrence is encoded as RRULE
    const ics = buildICS(state.timeBlocks, state.tasks.filter(t => t.scheduledDate));
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2nd-brain-calendar.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Calendar exported (.ics) — import it into Google or Apple Calendar');
  }

  // Pixel helpers for absolute-positioned events
  const gridTopMin = DAY_START * 60;
  const minToTop = (min: number) => ((min - gridTopMin) / 60) * HOUR_PX;
  const durToHeight = (mins: number) => Math.max(22, (mins / 60) * HOUR_PX);

  // Day strip dot indicator: includes mirror events
  const hasMirrorOnDay = (ds: string) =>
    (mirrorEvents ?? []).some(e => e.date === ds && e.startMin !== null);

  return (
    <div className="pb-4">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">🗓️ Calendar</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          {gcConnected && (
            <button
              onClick={() => syncMutation.mutate({})}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--foreground)] bg-white hover:border-[var(--sky-light)] transition-colors disabled:opacity-50"
              title="Pull latest events from Google Calendar"
            >
              {syncMutation.isPending ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <span>🔄</span>
              )}
              Sync Google
            </button>
          )}
          <button
            onClick={exportICS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--foreground)] bg-white hover:border-[var(--sky-light)] transition-colors"
          >
            📤 Export
          </button>
          <button
            onClick={() => setPanelOpen(p => !p)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold btn-sky"
          >
            📋 Tasks
          </button>
        </div>
      </div>

      <GoalBanner compact />

      {/* 13-DAY STRIP */}
      <div className="flex gap-1.5 px-4 mt-3 overflow-x-auto pb-1 scrollbar-none">
        {days.map(ds => {
          const d = parseYMD(ds);
          const isActive = ds === activeDateStr;
          const isToday = ds === todayStr;
          const hasEvent =
            state.tasks.some(t => tasksOnDate([t], ds).length > 0 && t.scheduledTime) ||
            state.timeBlocks.some(b => blocksOnDate([b], ds).length > 0) ||
            hasMirrorOnDay(ds);
          return (
            <button
              key={ds}
              onClick={() => setActiveDateStr(ds)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-2.5 rounded-2xl min-w-[46px] transition-all select-none cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-white shadow-md'
                  : `bg-white border ${isToday ? 'border-[var(--sky)]' : 'border-[var(--border)]'} text-[var(--muted-foreground)] hover:shadow-sm`
              }`}
              style={isActive ? { background: 'linear-gradient(160deg, #2E86C1 0%, #5DADE2 100%)' } : {}}
            >
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-white/80' : ''}`}>
                {DAYS_SHORT[d.getUTCDay()]}
              </span>
              <span className={`text-base font-bold leading-none ${isActive ? 'text-white' : isToday ? 'text-[var(--sky)]' : ''}`}>
                {d.getUTCDate()}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                hasEvent ? (isActive ? 'bg-white/70' : 'bg-[var(--sky)]') : 'opacity-0'
              }`} />
            </button>
          );
        })}
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex gap-0 md:gap-4 md:px-4 mt-3">

        {/* TIME GRID */}
        <div className="flex-1 overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 300px)' }}>
            <div className="relative" style={{ minHeight: `${HOURS.length * HOUR_PX}px` }}>
              {/* Hour rows (background + drop targets + tap-to-create) */}
              {HOURS.map(hour => {
                const isDropTarget = dropHour === hour;
                return (
                  <div
                    key={hour}
                    className={`group flex border-b border-[var(--border)] transition-colors ${isDropTarget ? 'bg-[var(--sky-mist)]' : ''}`}
                    style={{ height: `${HOUR_PX}px` }}
                    onDragOver={e => { e.preventDefault(); setDropHour(hour); }}
                    onDragLeave={() => setDropHour(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDropHour(null);
                      if (draggingTask) openDurationModal(draggingTask, hour);
                    }}
                  >
                    <div className="w-14 shrink-0 px-2 pt-1">
                      <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
                        {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                      </span>
                    </div>
                    <button
                      onClick={() => newBlockAtHour(hour)}
                      className="flex-1 text-left relative pr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Add time block at ${hour}:00`}
                    >
                      <span className="absolute left-1 top-1 text-[11px] text-[var(--sky)] font-semibold">+ block</span>
                    </button>
                  </div>
                );
              })}

              {/* Time blocks (absolute, left lane) */}
              <div className="absolute left-14 right-2 top-0 bottom-0 pointer-events-none">
                {dayBlocks.map(b => {
                  const cat = b.categoryId ? getCategoryById(state, b.categoryId) : undefined;
                  const tt = getTaskType(b.taskType ?? undefined);
                  const accent = tt?.color || cat?.textColor || '#5DADE2';
                  return (
                    <button
                      key={b.id}
                      onClick={() => editBlock(b)}
                      className="absolute pointer-events-auto rounded-lg px-2 py-1 text-left overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow"
                      style={{
                        top: `${minToTop(b.startMin) + 2}px`,
                        height: `${durToHeight(b.endMin - b.startMin) - 4}px`,
                        left: '0%', width: '49%',
                        background: '#FFFFFF',
                        borderColor: accent,
                        zIndex: 3,
                      }}
                    >
                      <p className="text-xs font-semibold text-[var(--foreground)] truncate flex items-center gap-1">
                        {tt?.emoji || cat?.emoji || '⏳'} {b.title}
                        {b.recurFreq && <span className="text-[9px] text-[var(--muted-foreground)]">↻</span>}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{minToLabel(b.startMin)}–{minToLabel(b.endMin)}</p>
                    </button>
                  );
                })}

                {/* Scheduled tasks (absolute, right lane) */}
                {scheduledTasks.map(t => {
                  const h = parseInt(t.scheduledTime!.split(':')[0] || '0');
                  const m = parseInt(t.scheduledTime!.split(':')[1] || '0');
                  const startMin = h * 60 + m;
                  const mins = getTaskMinutes(t) || 30;
                  return (
                    <div
                      key={t.id}
                      className="absolute rounded-lg px-2 py-1 text-white overflow-hidden shadow-sm"
                      style={{
                        top: `${minToTop(startMin) + 2}px`,
                        height: `${durToHeight(mins) - 4}px`,
                        left: '50%', width: '49%',
                        background: 'linear-gradient(135deg, #2E86C1, #5DADE2)',
                        zIndex: 3,
                      }}
                    >
                      <p className="text-xs font-semibold truncate flex items-center gap-1">
                        {parseTitleDuration(t.title).cleanTitle || t.title}
                        {t.recurFreq && <span className="text-[9px] text-white/70">↻</span>}
                      </p>
                      <p className="text-white/70 text-[10px]">{minToLabel(startMin)}</p>
                    </div>
                  );
                })}

                {/* Google Calendar mirror events (read-only, overlaid on right half) */}
                {dayMirrorEvents.map(ev => {
                  const startMin = ev.startMin!;
                  const endMin = ev.endMin ?? startMin + 60;
                  const color = ev.colorHex ?? '#4285F4';
                  return (
                    <div
                      key={ev.id}
                      className="absolute rounded-lg px-2 py-1 overflow-hidden border border-dashed"
                      title={`${ev.title}${ev.calendarName ? ` · ${ev.calendarName}` : ''}`}
                      style={{
                        top: `${minToTop(startMin) + 2}px`,
                        height: `${durToHeight(endMin - startMin) - 4}px`,
                        left: '50%', width: '49%',
                        background: `${color}18`,
                        borderColor: color,
                        zIndex: 2,
                      }}
                    >
                      <p className="text-xs font-semibold truncate flex items-center gap-1" style={{ color }}>
                        <span className="text-[9px] font-bold bg-white rounded px-0.5" style={{ color }}>G</span>
                        {ev.title}
                      </p>
                      <p className="text-[10px]" style={{ color: `${color}cc` }}>{minToLabel(startMin)}–{minToLabel(endMin)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hint */}
          <p className="text-[11px] text-[var(--muted-foreground)] px-3 mt-2">
            Tap an empty slot to add a time block · drag a task in from the side to schedule it.
            {gcConnected && <span className="ml-2 text-[#4285F4]">· Google events shown in dashed outline</span>}
          </p>
        </div>

        {/* TASKS PANEL */}
        <div className={`
          md:w-64 md:shrink-0 md:block
          ${panelOpen ? 'fixed inset-0 z-40 md:static md:z-auto' : 'hidden md:block'}
        `}>
          {panelOpen && <div className="md:hidden absolute inset-0 bg-black/30" onClick={() => setPanelOpen(false)} />}

          <div className={`
            md:static md:rounded-xl md:border md:border-[var(--border)] md:bg-white md:h-full
            fixed right-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 md:z-auto md:shadow-none
            overflow-y-auto
          `}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <p className="font-semibold text-sm text-[var(--foreground)]">📋 My Tasks</p>
              <button onClick={() => setPanelOpen(false)} className="md:hidden text-[var(--muted-foreground)] text-lg">×</button>
            </div>

            {(['today', 'week', 'future'] as const).map(col => {
              const tasks = unscheduled.filter(t => t.column === col);
              if (!tasks.length) return null;
              const labels: Record<string, string> = { today: '⚡ Do Today', week: '📋 This Week', future: '🏔️ Future Goals' };
              return (
                <div key={col} className="p-3">
                  <p className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{labels[col]}</p>
                  {tasks.map(t => {
                    const cat = state.categories.find(c => c.id === t.categoryId);
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDraggingTask(t)}
                        onDragEnd={() => setDraggingTask(null)}
                        className="flex items-start gap-2 p-2.5 mb-1.5 rounded-xl border border-[var(--border)] bg-white cursor-grab active:cursor-grabbing hover:border-[var(--sky-light)] transition-all"
                      >
                        <span className="text-base shrink-0 mt-0.5">{cat?.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--foreground)] leading-snug truncate">{parseTitleDuration(t.title).cleanTitle || t.title}</p>
                          {(t.duration || parseTitleDuration(t.title).durationStr) && (
                            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{t.duration || parseTitleDuration(t.title).durationStr}</p>
                          )}
                        </div>
                        <span className="text-[var(--muted-foreground)] text-xs">⠿</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {unscheduled.length === 0 && (
              <div className="p-6 text-center text-[var(--muted-foreground)] text-sm">
                <p className="text-2xl mb-2">🎉</p>
                <p>All tasks scheduled!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DURATION MODAL (task scheduling) */}
      {durationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDurationModal(null)} />
          <div className="relative w-full max-w-[420px] mx-4 bg-white rounded-3xl p-6 shadow-2xl">
            <p className="font-semibold text-[var(--foreground)] mb-1 truncate">{parseTitleDuration(durationModal.task.title).cleanTitle || durationModal.task.title}</p>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Scheduling at {durationModal.hour < 12 ? `${durationModal.hour}am` : durationModal.hour === 12 ? '12pm' : `${durationModal.hour - 12}pm`}
            </p>
            <p className="text-sm font-semibold mb-3">How long?</p>
            <div className="flex gap-2 flex-wrap mb-6">
              {durationChips.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    selectedDuration === d ? 'border-transparent text-white btn-sky' : 'border-[var(--border)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button onClick={confirmSchedule} className="w-full py-3.5 rounded-2xl text-white font-bold btn-sky">Schedule →</button>
          </div>
        </div>
      )}

      {/* TIME BLOCK MODAL */}
      <TimeBlockModal draft={blockDraft} onClose={() => setBlockDraft(null)} />
    </div>
  );
}
