import Link from "next/link";
import type { ReactNode } from "react";

/** Brand wordmark — Fraunces with a brand dot, links home. */
function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex items-baseline gap-0.5 font-display text-lg tracking-tight text-ink transition-opacity hover:opacity-80"
    >
      Graft
      <span className="size-1.5 translate-y-[-1px] rounded-full bg-brand" aria-hidden="true" />
    </Link>
  );
}

/**
 * Editorial split layout for the auth screens, matching the landing aesthetic:
 * a brand panel (lg+) beside a frosted-glass form card, both lifted off the shared
 * animated backdrop. The page-load entrance is one orchestrated `intro-down`
 * stagger — calm enough to sit behind a form (no looping motion), and fully
 * disabled under `prefers-reduced-motion` via the keyframe.
 */
function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — editorial copy, hidden on small screens. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <div
          className="hero-bloom pointer-events-none absolute -left-1/4 top-0 h-[42rem] w-[42rem] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--l-brand-soft), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="intro-down relative" style={{ animationDelay: "0ms" }}>
          <Wordmark />
        </div>

        <div className="relative max-w-lg">
          <h1
            className="intro-down font-display text-[clamp(2.4rem,3.4vw,3.6rem)] leading-[1.05] tracking-tight text-ink"
            style={{ animationDelay: "100ms" }}
          >
            Support that feels like one{" "}
            <span className="bg-gradient-to-r from-brand-deep via-brand to-brand-deep bg-clip-text text-transparent">
              warm conversation
            </span>
            .
          </h1>
          <p
            className="intro-down mt-5 text-base leading-relaxed text-dim"
            style={{ animationDelay: "200ms" }}
          >
            Greet every customer with clear, grounded help, then hand off softly to
            your team the moment a person is needed.
          </p>
        </div>

        <p
          className="intro-down relative text-sm text-faint"
          style={{ animationDelay: "300ms" }}
        >
          Trusted by teams who care how support feels.
        </p>
      </aside>

      {/* Form column. */}
      <main className="flex flex-col px-5 py-8 sm:px-8">
        <div className="lg:hidden">
          <Wordmark />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div
            className="intro-down glass w-full max-w-md rounded-2xl p-7 sm:p-9"
            style={{ animationDelay: "120ms" }}
          >
            {title ? (
              <div className="mb-7 flex flex-col gap-2">
                <h2 className="font-display text-2xl leading-tight tracking-tight text-ink">
                  {title}
                </h2>
                {description ? (
                  <p className="text-sm leading-relaxed text-dim">{description}</p>
                ) : null}
              </div>
            ) : null}

            {children}

            {footer ? (
              <div className="mt-6 border-t border-line2 pt-5 text-center text-sm text-dim">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export { AuthShell };
