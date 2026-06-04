import type { ReactNode } from "react";

/**
 * Auth surface — deliberately *without* the WebGL backdrop. A form deserves a
 * calm, static stage, so we paint a fixed atmospheric layer instead: two soft
 * brand glows and a faint masked grid for depth. No looping motion behind the
 * inputs; the only entrance is the card's `intro-down` stagger.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="auth-backdrop pointer-events-none fixed inset-0 -z-10"
      />
      <div className="relative z-10">{children}</div>
    </>
  );
}
