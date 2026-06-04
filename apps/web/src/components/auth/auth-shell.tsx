import Link from "next/link";
import type { ReactNode } from "react";

import { ModeToggle } from "@/components/site/ModeToggle";

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
 * Auth shell — a single big glass card holding an editorial panel beside the
 * form, with the logo and the theme switch lifted out above it. The whole card
 * enters as one `intro-down` unit (no per-element looping motion behind a form),
 * fully disabled under `prefers-reduced-motion` via the keyframe.
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
    <div className="flex min-h-dvh w-full flex-col px-5 py-6 sm:px-8">
      {/* Top bar — logo + theme switch, kept outside the card. */}
      <header
        className="intro-down flex items-center justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <Wordmark />
        <ModeToggle />
      </header>

      {/* One big card: editorial panel + form. */}
      <div className="flex flex-1 items-center justify-center py-8">
        <div
          className="intro-down glass w-full max-w-md overflow-hidden rounded-[1.75rem] lg:w-[75vw] lg:max-w-[80rem]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="grid lg:min-h-[75vh] lg:grid-cols-[1.05fr_1fr]">
            {/* Editorial panel — hidden on small screens. */}
            <aside className="relative hidden flex-col justify-between gap-16 overflow-hidden border-r border-line2 p-12 lg:flex lg:p-14 xl:p-16">
              <div
                className="hero-bloom pointer-events-none absolute -left-1/3 -top-1/4 h-[38rem] w-[38rem] rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, var(--l-brand-soft), transparent 70%)",
                }}
                aria-hidden="true"
              />
              <div className="relative max-w-md">
                <h1 className="font-display text-[clamp(2rem,2.6vw,3rem)] leading-[1.06] tracking-tight text-ink">
                  Support that feels like one{" "}
                  <span className="bg-gradient-to-r from-brand-deep via-brand to-brand-deep bg-clip-text text-transparent">
                    warm conversation
                  </span>
                  .
                </h1>
                <p className="mt-5 text-base leading-relaxed text-dim">
                  Greet every customer with clear, grounded help, then hand off softly
                  to your team the moment a person is needed.
                </p>
              </div>

              <p className="relative text-sm text-faint">
                Trusted by teams who care how support feels.
              </p>
            </aside>

            {/* Form side — content capped for readability inside the wide card. */}
            <main className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
              <div className="mx-auto w-full max-w-sm">
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
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AuthShell };
