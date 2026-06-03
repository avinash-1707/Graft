"use client";

import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";

/**
 * Lenis smooth scroll, mounted at the root. `anchors` lets in-page hash links
 * (#how, #features, …) ease to target instead of jumping. Respects the user's
 * reduced-motion preference via Lenis' built-in check.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        duration: 1.1,
        smoothWheel: true,
        anchors: { offset: -80 },
      }}
    >
      {children}
    </ReactLenis>
  );
}
