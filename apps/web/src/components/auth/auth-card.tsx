"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; description: string }> = {
  login: {
    title: "Welcome back",
    description: "Sign in to your Graft dashboard.",
  },
  signup: {
    title: "Create your workspace",
    description: "Set up your organization and start handling support in minutes.",
  },
};

/** Left-to-right order; drives the slide direction of the crossfade. */
const ORDER: Record<Mode, number> = { login: 0, signup: 1 };

/**
 * Combined sign-in / sign-up card. The two forms live behind one segmented
 * toggle and swap via local state — no navigation, no remount of the shell.
 * Motion: a sliding pill on the toggle, a height-animated stage so the card
 * grows/shrinks between the two forms, and a direction-aware crossfade on the
 * swapped content. All gated by `prefers-reduced-motion` in globals.css.
 */
function AuthCard({
  initialMode = "login",
  notice,
}: {
  initialMode?: Mode;
  notice?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Track the live content height so the stage resizes smoothly — both when
  // switching forms and when validation messages appear or clear.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function switchTo(next: Mode) {
    if (next === mode) return;
    setDir(ORDER[next] > ORDER[mode] ? 1 : -1);
    setHasSwitched(true);
    setMode(next);
    // Keep the URL in sync without a navigation so a refresh restores the mode.
    window.history.replaceState(null, "", next === "login" ? "/login" : "/signup");
  }

  const copy = COPY[mode];

  return (
    <div className="w-full">
      {/* Segmented mode toggle with a sliding pill. */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="relative mb-7 grid grid-cols-2 rounded-xl border border-line2 bg-white/5 p-1 dark:bg-white/[0.03]"
      >
        <span
          aria-hidden="true"
          className="auth-toggle-pill absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg"
          style={{ transform: `translateX(${mode === "signup" ? "100%" : "0%"})` }}
        />
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchTo(m)}
            className={`relative z-10 rounded-lg py-2 text-sm font-medium transition-colors duration-200 ${
              mode === m ? "text-ink" : "text-dim hover:text-soft"
            }`}
          >
            {m === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {mode === "login" && notice ? <div className="mb-5">{notice}</div> : null}

      {/* Height-animated stage; swapped content crossfades + slides per mode. */}
      <div className="auth-stage" style={height === null ? undefined : { height }}>
        <div ref={innerRef}>
          <div
            key={mode}
            className={hasSwitched ? "auth-swap" : undefined}
            style={{ "--auth-dir": dir } as CSSProperties}
          >
            <div className="mb-7 flex flex-col gap-2">
              <h2 className="font-display text-2xl leading-tight tracking-tight text-ink">
                {copy.title}
              </h2>
              <p className="text-sm leading-relaxed text-dim">{copy.description}</p>
            </div>

            {mode === "login" ? <LoginForm /> : <SignupForm />}
          </div>
        </div>
      </div>
    </div>
  );
}

export { AuthCard };
