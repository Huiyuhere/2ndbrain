import { useApp } from '@/contexts/AppContext';

interface UserAvatarProps {
  /** Diameter in pixels — rendered as w-{size} h-{size} via inline style */
  size?: number;
  className?: string;
}

/**
 * Shows the user's profile avatar if one is set, otherwise falls back to
 * the first two letters of their name (or "ME" if name is empty).
 * Reads directly from AppContext so it stays in sync everywhere.
 */
export default function UserAvatar({ size = 36, className = '' }: UserAvatarProps) {
  const { state } = useApp();
  const profile = state.userProfile;
  const avatarUrl = profile?.avatarUrl ?? '';
  const name = profile?.name ?? '';
  const initials = name.trim().length > 0 ? name.trim().slice(0, 2).toUpperCase() : 'ME';

  const style: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.max(10, Math.round(size * 0.38)),
    fontWeight: 700,
    color: 'white',
    background: 'linear-gradient(135deg, #2E86C1, #5DADE2)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    flexShrink: 0,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Profile'}
        style={{ ...style, objectFit: 'cover' }}
        className={className}
      />
    );
  }

  return (
    <div style={style} className={className}>
      {initials}
    </div>
  );
}
