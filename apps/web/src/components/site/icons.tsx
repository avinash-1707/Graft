type IconProps = { className?: string };

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function GroundedIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} width="22" height="22">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3" />
      <path d="M8 8.5h6.5M8 12h4.5" />
    </svg>
  );
}

export function HandoffIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} width="22" height="22">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M3 19v-1a5 5 0 0 1 9.2-2.7" />
      <path d="M13.5 19v-.5a4 4 0 0 1 7.5-1.9" />
    </svg>
  );
}

export function MemoryIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} width="22" height="22">
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 4v4.5h-4.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function CraftIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} width="22" height="22">
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="9" cy="6" r="1.9" fill="var(--l-base)" />
      <circle cx="15" cy="12" r="1.9" fill="var(--l-base)" />
      <circle cx="8" cy="18" r="1.9" fill="var(--l-base)" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} width="16" height="16">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
