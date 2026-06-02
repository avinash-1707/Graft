import { ChatIcon, CloseIcon } from './icons';

/**
 * Floating circular launcher. Always reachable (≥44×44px touch target) and never
 * clipped by the host page. Toggles the panel; shows a close glyph while open so
 * it doubles as a dismiss control on desktop.
 */
export function Launcher({
  open,
  unread,
  onToggle,
}: {
  readonly open: boolean;
  readonly unread: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close chat' : 'Open chat'}
      aria-expanded={open}
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--graft-accent-primary)] text-[var(--graft-text-inverted)] shadow-lg transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
    >
      {open ? <CloseIcon className="h-6 w-6" /> : <ChatIcon className="h-6 w-6" />}
      {unread && !open ? (
        <span
          className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border-2"
          style={{
            backgroundColor: '#dc2626',
            borderColor: 'var(--graft-accent-primary)',
          }}
        />
      ) : null}
    </button>
  );
}
