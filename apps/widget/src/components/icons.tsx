/**
 * Minimal inline stroke icons. The widget ships its own SVGs rather than pulling
 * an icon dependency, keeping the embed bundle small and fully self-contained
 * inside the Shadow DOM. Stroke-based to match ui-context.md.
 */
interface IconProps {
  readonly className?: string;
}

function svgProps(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
