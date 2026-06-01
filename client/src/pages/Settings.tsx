import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';
import { useLocation } from 'wouter';

const COLOUR_OPTIONS = [
  '#2E86C1','#5DADE2','#F0B429','#4A7C59','#C4A882','#C0392B',
  '#8E44AD','#E67E22','#16A085','#2C3E50','#E74C3C','#27AE60',
];

const EMOJI_OPTIONS = ['💼','💡','🌸','📚','🏃','🧠','🌐','🎯','💎','🔥','⚡','🎨'];

const LEGACY_KEY = '2nd-brain-state';

export default function Settings() {
  const { state, updateCategories } = useApp();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const importMutation = trpc.sync.importLegacy.useMutation({
    onSuccess: () => {
      utils.sync.loadAll.invalidate();
      toast.success('Data imported successfully! Refreshing...');
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });
  const [categories, setCategories] = useState(state.categories);
  const [importDone, setImportDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ name: '', emoji: '💡', color: '#2E86C1' });
  const [addingCat, setAddingCat] = useState(false);
  const [morningTime, setMorningTime] = useState('07:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [weeklyTime, setWeeklyTime] = useState('Sunday 20:00');
  const [remindersOn, setRemindersOn] = useState(true);
  const [habitReminder, setHabitReminder] = useState(true);
  const [streakAlert, setStreakAlert] = useState(true);

  function saveCategory(id: string, updates: Partial<typeof categories[0]>) {
    const updated = categories.map(c => c.id === id ? { ...c, ...updates } : c);
    setCategories(updated);
    updateCategories(updated);
    setEditingId(null);
    toast.success('Category updated');
  }

  function deleteCategory(id: string) {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    updateCategories(updated);
    toast.success('Category deleted');
  }

  function handleImport() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) {
        toast.error('No local data found on this device.');
        return;
      }
      const legacy = JSON.parse(raw);
      importMutation.mutate({
        profile: {
          name: legacy.userProfile?.name,
          bio: legacy.userProfile?.bio,
          focusMode: legacy.focusMode,
          monthlyIntention: legacy.monthlyIntention,
          quarterlyGoalText: legacy.quarterlyGoal?.text,
          quarterlyGoalProgress: legacy.quarterlyGoal?.progress,
        },
        categories: legacy.categories,
        tasks: legacy.tasks,
        habits: legacy.habits,
        goals: legacy.goals,
        roadmapProjects: legacy.roadmapProjects,
        moodEntries: legacy.moodEntries,
        eveningEntries: legacy.eveningEntries,
        reflections: legacy.reflections,
      });
      setImportDone(true);
    } catch (e) {
      toast.error('Could not read local data. It may be corrupted.');
    }
  }

  function addCategory() {
    if (!newCat.name.trim()) return;
    const id = `cat_${Date.now()}`;
    const updated = [...categories, {
      id, name: newCat.name, emoji: newCat.emoji,
      bgColor: newCat.color + '20', textColor: newCat.color,
      keywords: [],
    }];
    setCategories(updated);
    updateCategories(updated);
    setNewCat({ name: '', emoji: '💡', color: '#2E86C1' });
    setAddingCat(false);
    toast.success(`Category "${newCat.name}" added`);
  }

  return (
    <div className="pb-4">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">⚙️ Settings</div>
          <div className="topbar-sub">Preferences & categories</div>
        </div>
      </div>

      {/* PROFILE */}
      <div
        className="mx-4 mt-3 p-4 rounded-2xl border border-[var(--border)] bg-white flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform hover:border-[var(--sky)]/40"
        onClick={() => setLocation('/profile')}
        role="button"
        aria-label="Edit profile"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>TH</div>
        <div>
          <p className="font-semibold text-[var(--foreground)]">TH</p>
          <p className="text-sm text-[var(--muted-foreground)]">ENFJ · Empire Builder</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="streak-badge text-xs">🔥 {state.streak} day streak</span>
          </div>
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="section-hdr mt-5">
        <div className="section-hdr-title">🎨 Categories</div>
        <button onClick={() => setAddingCat(true)} className="section-hdr-action">+ Add</button>
      </div>
      <div className="px-4 space-y-2">
        {categories.map(cat => (
          <div key={cat.id}>
            {editingId === cat.id ? (
              <div className="p-3 rounded-xl border-2 border-[var(--sky)] bg-white space-y-2">
                <input
                  className="input-field"
                  defaultValue={cat.name}
                  id={`edit-name-${cat.id}`}
                  placeholder="Category name"
                />
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} className="w-8 h-8 rounded-lg text-lg border border-[var(--border)] hover:border-[var(--sky)] transition-all">{e}</button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {COLOUR_OPTIONS.map(c => (
                    <button key={c} onClick={() => saveCategory(cat.id, { bgColor: c + '20', textColor: c })}
                      className="w-7 h-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveCategory(cat.id, { name: (document.getElementById(`edit-name-${cat.id}`) as HTMLInputElement)?.value || cat.name })}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white btn-sky">Save</button>
                  <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-xl text-sm border border-[var(--border)]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white">
                <span className="text-xl w-8 text-center">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{cat.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: cat.textColor }} />
                    <span className="text-[10px] text-[var(--muted-foreground)]">{cat.textColor}</span>
                  </div>
                </div>
                <button onClick={() => setEditingId(cat.id)} className="text-xs text-[var(--sky)] font-medium px-2 py-1">Edit</button>
                <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-400 font-medium px-2 py-1">Del</button>
              </div>
            )}
          </div>
        ))}

        {/* Add category */}
        {addingCat && (
          <div className="p-3 rounded-xl border-2 border-[var(--sky)] bg-white space-y-2">
            <input className="input-field" placeholder="Category name" value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} />
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewCat(n => ({ ...n, emoji: e }))}
                  className={`w-8 h-8 rounded-lg text-lg border-2 transition-all ${newCat.emoji === e ? 'border-[var(--sky)]' : 'border-[var(--border)]'}`}>{e}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLOUR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewCat(n => ({ ...n, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${newCat.color === c ? 'border-[var(--sky)] scale-110' : 'border-white shadow-sm'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={addCategory} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white btn-sky">Add</button>
              <button onClick={() => setAddingCat(false)} className="flex-1 py-2 rounded-xl text-sm border border-[var(--border)]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* REMINDERS */}
      <div className="section-hdr mt-5">
        <div className="section-hdr-title">🔔 Reminders</div>
        <button
          onClick={() => setRemindersOn(r => !r)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${remindersOn ? 'bg-[var(--sky)] text-white' : 'border border-[var(--border)] text-[var(--muted-foreground)]'}`}
        >
          {remindersOn ? 'On' : 'Off'}
        </button>
      </div>
      <div className="px-4 space-y-3">
        {[
          { label: '☀️ Morning check-in', value: morningTime, set: setMorningTime, type: 'time' },
          { label: '🌙 Evening journal', value: eveningTime, set: setEveningTime, type: 'time' },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-white">
            <p className="text-sm font-medium text-[var(--foreground)]">{r.label}</p>
            <input
              type="time"
              className="text-sm font-semibold text-[var(--sky)] bg-transparent border-none outline-none"
              value={r.value}
              onChange={e => r.set(e.target.value)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-white">
          <p className="text-sm font-medium text-[var(--foreground)]">📋 Weekly reflection</p>
          <p className="text-sm font-semibold text-[var(--sky)]">Sun 20:00</p>
        </div>
        {[
          { label: '🔥 Habit reminder', value: habitReminder, set: setHabitReminder },
          { label: '⚡ Streak alert', value: streakAlert, set: setStreakAlert },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-white">
            <p className="text-sm font-medium text-[var(--foreground)]">{r.label}</p>
            <button
              onClick={() => r.set(v => !v)}
              className={`w-11 h-6 rounded-full transition-all relative ${r.value ? 'bg-[var(--sky)]' : 'bg-[var(--border)]'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${r.value ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* IMPORT FROM DEVICE */}
      <div className="section-hdr mt-5">
        <div className="section-hdr-title">📦 Data Import</div>
      </div>
      <div className="px-4">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-white">
          <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Import from this device</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-3 leading-relaxed">
            Copies all tasks, habits, goals, roadmap, journal entries, and reflections stored locally on this browser into your account database. Existing data is preserved — nothing is overwritten.
          </p>
          {importDone ? (
            <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Import complete!
            </div>
          ) : (
            <button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white btn-sky disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {importMutation.isPending ? (
                <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Importing...</>
              ) : (
                <>📥 Import from this device</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ABOUT */}
      <div className="mx-4 mt-5 p-4 rounded-2xl bg-[var(--sky-mist)] border border-[var(--sky)]/20 text-center">
        <p className="font-['Playfair_Display'] font-bold text-[var(--sky)] text-lg">2nd Brain</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Your life OS · v1.0</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Built for empire builders.</p>
      </div>
    </div>
  );
}
