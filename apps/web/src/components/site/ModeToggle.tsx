"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// Pure icon by default — no border or fill. The glass surface only materializes
// on hover/focus so it reads as a quiet control until the user reaches for it.
const triggerClass =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-soft " +
  "border border-transparent transition-colors duration-200 " +
  "hover:border-[var(--l-glass-border)] hover:bg-[var(--l-glass)] hover:text-ink " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Pre-hydration placeholder keeps layout stable and avoids a theme mismatch.
  if (!mounted) {
    return <span className={triggerClass} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={triggerClass}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className="h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
    </button>
  );
}
