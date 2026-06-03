import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Task, getTaskMinutes, parseTitleDuration } from '@/lib/store';
import CategoryPill from '@/components/CategoryPill';
import GoalBanner from '@/components/GoalBanner';
import WeekStrip, { getWeekDays, toLocalDateStr } from '@/components/WeekStrip';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am – 9pm
const DURATIONS = ['30m', '1h', '1.5h', '2h', '3h'];

export default function CalendarPage() {
  const { state, updateTask } = useApp();

  // Use shared helper — always based on real current date
  const weekDays = getWeekDays();
  const today = new Date();
  const todayIdx = weekDays.findIndex(d =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
  const [activeDay, setActiveDay] = useState(todayIdx);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dropHour, setDropHour] = useState<number | null>(null);
  const [durationModal, setDurationModal] = useState<{ task: Task; hour: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('1h');

  const activeDate = weekDays[activeDay];
  // Use local date string to avoid UTC-offset shifting the date
  const activeDateStr = toLocalDateStr(activeDate);

  // Tasks scheduled on active day
  const scheduledTasks = state.tasks.filter(t => t.scheduledDate === activeDateStr && t.scheduledTime);
  // Unscheduled tasks for import panel
  const unscheduled = state.tasks.filter(t => t.column !== 'done' && !t.scheduledDate);

  function confirmSchedule() {
    if (!durationModal) return;
    const timeStr = `${String(durationModal.hour).padStart(2, '0')}:00`;
    updateTask(durationModal.task.id, {
      scheduledDate: activeDateStr,
      scheduledTime: timeStr,
      duration: selectedDuration,
    });
    setDurationModal(null);
    toast.success(`Scheduled: ${durationModal.task.title}`);
  }

  function getBlockHeight(task: Task): number {
    const mins = getTaskMinutes(task);
    if (mins <= 0) return 60; // default 1h
    // 60px = 1 hour; proportional scaling, min 30px
    return Math.max(30, Math.round((mins / 60) * 60));
  }

  function getDurationLabel(task: Task): string {
    if (task.duration) return task.duration;
    const { durationStr } = parseTitleDuration(task.title);
    return durationStr;
  }

  function getTaskAtHour(hour: number) {
    return scheduledTasks.find(t => {
      const h = parseInt(t.scheduledTime?.split(':')[0] || '0');
      return h === hour;
    });
  }

  // Month/year label for topbar
  const monthLabel = activeDate.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

  return (
    <div className="pb-4">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">🗓️ Calendar</div>
          <div className="topbar-sub">{monthLabel}</div>
        </div>
        <button
          onClick={() => setPanelOpen(p => !p)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold btn-sky"
        >
          📋 Import
        </button>
      </div>

      <GoalBanner compact />

      {/* WEEK STRIP — shared component, uses local date strings for event dots */}
      <WeekStrip
        activeIndex={activeDay}
        onDaySelect={setActiveDay}
        eventDots={weekDays.map(d => state.tasks.some(t => t.scheduledDate === toLocalDateStr(d)))}
      />

      {/* MAIN LAYOUT: Calendar + Import Panel side by side on desktop */}
      <div className="flex gap-0 md:gap-4 md:px-4 mt-3">

        {/* TIME GRID */}
        <div className="flex-1 overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 280px)' }}>
            <div className="relative" style={{ minHeight: `${HOURS.length * 60}px` }}>
              {HOURS.map(hour => {
                const task = getTaskAtHour(hour);
                const isDropTarget = dropHour === hour;
                return (
                  <div
                    key={hour}
                    className={`flex border-b border-[var(--border)] transition-colors ${isDropTarget ? 'bg-[var(--sky-mist)]' : ''}`}
                    style={{ height: '60px' }}
                    onDragOver={e => { e.preventDefault(); setDropHour(hour); }}
                    onDragLeave={() => setDropHour(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDropHour(null);
                      if (draggingTask) setDurationModal({ task: draggingTask, hour });
                    }}
                  >
                    <div className="w-14 shrink-0 px-2 pt-1">
                      <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
                        {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                      </span>
                    </div>
                    <div className="flex-1 relative pr-2">
                      {task && (
                        <div
                          className="absolute left-0 right-2 top-1 rounded-lg px-2 py-1 text-white text-xs font-semibold overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #2E86C1, #5DADE2)',
                            height: `${getBlockHeight(task) - 8}px`,
                            zIndex: 2,
                          }}
                        >
                          <p className="truncate">{parseTitleDuration(task.title).cleanTitle || task.title}</p>
                          {getDurationLabel(task) && (
                            <p className="text-white/70 text-[10px]">{getDurationLabel(task)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* IMPORT PANEL — slides in on mobile, always visible on desktop */}
        <div className={`
          md:w-64 md:shrink-0 md:block
          ${panelOpen ? 'fixed inset-0 z-40 md:static md:z-auto' : 'hidden md:block'}
        `}>
          {/* Mobile overlay */}
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
                          <p className="text-xs font-medium text-[var(--foreground)] leading-snug truncate">{t.title}</p>
                          {t.duration && <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{t.duration}</p>}
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

      {/* DURATION MODAL */}
      {durationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDurationModal(null)} />
          <div className="relative w-full max-w-[420px] mx-4 bg-white rounded-3xl p-6 shadow-2xl">
            <p className="font-semibold text-[var(--foreground)] mb-1 truncate">{durationModal.task.title}</p>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Scheduling at {durationModal.hour < 12 ? `${durationModal.hour}am` : durationModal.hour === 12 ? '12pm' : `${durationModal.hour - 12}pm`}
            </p>
            <p className="text-sm font-semibold mb-3">How long?</p>
            <div className="flex gap-2 flex-wrap mb-6">
              {DURATIONS.map(d => (
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
    </div>
  );
}
