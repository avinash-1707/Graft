type LogoProps = {
  className?: string;
  withWordmark?: boolean;
};

/**
 * The graft mark: two strands arriving from the left and joining into a single
 * line that continues right. A quiet visual of the product idea, two ways of
 * helping grown into one conversation.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M2 6.5C8 6.5 9.5 13 13 13C16.5 13 18 6.5 24 6.5"
          stroke="var(--l-brand)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M2 19.5C8 19.5 9.5 13 13 13C16.5 13 18 19.5 24 19.5"
          stroke="var(--l-brand-deep)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="13" cy="13" r="2.1" fill="var(--l-ink)" />
      </svg>
      {withWordmark && (
        <span className="font-display text-[1.35rem] leading-none tracking-tight text-ink">
          Graft
        </span>
      )}
    </span>
  );
}
