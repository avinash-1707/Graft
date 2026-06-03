import { cn } from "@/lib/utils";

/** Graft union mark: two strokes grafted into one. */
function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        className="size-6 text-brand"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 21V11a4 4 0 0 1 4-4h2" />
        <path d="M19 21V11a4 4 0 0 0-4-4h-2" />
        <path d="M12 3v8" />
      </svg>
      <span className="font-display text-lg tracking-tight">Graft</span>
    </span>
  );
}

export { Logo };
