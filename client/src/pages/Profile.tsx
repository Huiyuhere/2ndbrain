import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

export default function Profile() {
  const { state, updateProfile } = useApp();
  const profile = state.userProfile || { name: 'TH', bio: 'Building the future, one day at a time.', avatarUrl: '' };

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    updateProfile({ name: name.trim() || 'TH', bio: bio.trim(), avatarUrl });
    toast.success('Profile updated!');
    setEditing(false);
  }

  function handleCancel() {
    setName(profile.name);
    setBio(profile.bio);
    setAvatarUrl(profile.avatarUrl);
    setEditing(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
    };
    reader.readAsDataURL(file);
  }

  const initials = (profile.name || 'TH').slice(0, 2).toUpperCase();
  const displayAvatar = editing ? avatarUrl : profile.avatarUrl;

  // Stats
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(t => t.column === 'done').length;
  const totalHabits = state.habits.length;
  const streak = state.streak || 0;
  const totalGoals = state.goals.length;
  const totalReflections = state.reflections.length;

  return (
    <div className="pb-8">
      <div className="topbar">
        <div>
          <BackButton />
          <div className="topbar-title mt-0.5">👤 Profile</div>
          <div className="topbar-sub">Your 2nd Brain identity</div>
        </div>
        {!editing && (
          <button
            onClick={() => { setName(profile.name); setBio(profile.bio); setAvatarUrl(profile.avatarUrl); setEditing(true); }}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white btn-sky flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        )}
      </div>

      {/* AVATAR + NAME HERO */}
      <div className="mx-4 mt-3 p-6 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #2E86C1, #5DADE2)' }}>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="Avatar"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold border-2 border-white/40" style={{ background: 'rgba(255,255,255,0.2)' }}>
                {initials}
              </div>
            )}
            {editing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-md"
                title="Upload photo"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E86C1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Name + bio */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <>
                <input
                  className="w-full bg-white/20 text-white placeholder-white/60 rounded-xl px-3 py-2 text-lg font-bold border border-white/30 outline-none mb-2"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                />
                <textarea
                  className="w-full bg-white/20 text-white placeholder-white/60 rounded-xl px-3 py-2 text-sm border border-white/30 outline-none resize-none"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="A short bio…"
                  rows={2}
                />
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-white">{profile.name}</p>
                <p className="text-sm text-white/80 mt-1 leading-relaxed">{profile.bio || 'No bio yet.'}</p>
              </>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex gap-3 mt-4">
            <button onClick={handleCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/20 text-white border border-white/30">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-white text-[#2E86C1]">
              Save profile
            </button>
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Tasks done', value: doneTasks, icon: '✅', color: '#2E86C1' },
          { label: 'Habits', value: totalHabits, icon: '🔥', color: '#F0B429' },
          { label: 'Day streak', value: streak, icon: '⚡', color: '#C0392B' },
          { label: 'Goals', value: totalGoals, icon: '🎯', color: '#4A7C59' },
          { label: 'Reflections', value: totalReflections, icon: '📖', color: '#6B5EA8' },
          { label: 'Total tasks', value: totalTasks, icon: '📋', color: '#C4A882' },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-2xl border border-[var(--border)] bg-white text-center">
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* FOCUS MODE */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-1">🎛️ Current Focus Mode</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {state.focusMode === 'life' ? '🌍 Life — seeing everything' : state.focusMode === 'work' ? '💼 Work — business & projects only' : '🌸 Personal — self & ideas only'}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">Change in Settings → Focus Mode</p>
      </div>

      {/* ABOUT */}
      <div className="mx-4 mt-4 p-4 rounded-2xl border border-[var(--border)] bg-white">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-2">🧠 About 2nd Brain</p>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          Your 2nd Brain is a personal life OS — built to help you capture ideas, track habits, plan projects, and reflect on your journey. All data is stored locally on your device.
        </p>
      </div>
    </div>
  );
}
