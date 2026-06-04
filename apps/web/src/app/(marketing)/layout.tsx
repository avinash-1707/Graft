import type { ReactNode } from "react";
import { Component as AnimatedBackground } from "@/components/ui/raycast-animated-background";

/** Marketing surface — the landing page sits over the shared WebGL backdrop. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10">{children}</div>
    </>
  );
}
