// BackButton — shown at top of pages accessible from /more on mobile.
// Uses wouter's useLocation to go back, with a fallback href.
import { useLocation } from 'wouter';

type Props = {
  fallback?: string; // fallback href if history is empty
  label?: string;    // optional label next to arrow
};

export default function BackButton({ fallback = '/more', label = 'Back' }: Props) {
  const [, navigate] = useLocation();

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(fallback);
    }
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-1.5 text-[var(--sky)] text-sm font-semibold py-1 pr-2 rounded-lg hover:bg-[var(--sky-mist)] transition-all active:scale-95"
      aria-label="Go back"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
        <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
