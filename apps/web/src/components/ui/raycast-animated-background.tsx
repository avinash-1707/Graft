"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { UnicornScene } from "unicornstudio-react";

/**
 * Animated WebGL backdrop. The Unicorn SDK fetch + shader compile block the main
 * thread, so we hold the scene mount until the hero/nav intro has played, then
 * fade it in. Without this the entrance animations stutter on first paint.
 */
export const Component = ({ className }: { className?: string }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idle: number | undefined;
    // Wait out the entrance window, then mount on an idle slot if available.
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idle = window.requestIdleCallback(() => setReady(true));
      } else {
        setReady(true);
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
      if (idle !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idle);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-700 ease-out",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
      aria-hidden="true"
    >
      {ready && (
        <UnicornScene
          production={true}
          projectId="cbmTT38A0CcuYxeiyj5H"
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.31/dist/unicornStudio.umd.js"
          width="100%"
          height="100%"
          lazyLoad={false}
          dpi={1.5}
        />
      )}
    </div>
  );
};
