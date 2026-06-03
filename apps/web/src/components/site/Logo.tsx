type LogoProps = {
  className?: string;
  withWordmark?: boolean;
};

/**
 * The graft mark — the graft union. Two strands (AI = brand red, human = deep
 * red) arrive from the left, bind at a single union node, and grow on as one
 * continuous line. The product idea: two ways of helping grafted into one
 * conversation, the silent SSE/WS handoff shown as the bind point.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M5 9.5C10 9.5 11.5 16 16 16"
          stroke="var(--l-brand)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M5 22.5C10 22.5 11.5 16 16 16"
          stroke="var(--l-brand-deep)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M16 16C20.5 16 22 16 27 16"
          stroke="var(--l-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="2.6" fill="var(--l-ink)" />
      </svg>
      {withWordmark && (
        <span className="font-display text-[1.35rem] leading-none tracking-tight text-ink">
          Graft
        </span>
      )}
    </span>
  );
}
