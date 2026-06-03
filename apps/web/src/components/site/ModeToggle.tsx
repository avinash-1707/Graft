"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const triggerClass =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-full glass text-soft " +
  "transition-colors duration-200 hover:text-ink focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-base";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Pre-hydration placeholder keeps layout stable and avoids a theme mismatch.
  if (!mounted) {
    return <span className={triggerClass} aria-hidden="true" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass} aria-label="Switch theme">
        <Sun className="h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-40">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="gap-2.5"
          >
            <Icon className="size-4 opacity-80" />
            <span>{label}</span>
            {theme === value && <Check className="ml-auto size-3.5 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
