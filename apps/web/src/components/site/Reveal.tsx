"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  /** Stagger delay in milliseconds. */
  delay?: number;
  /** Reveal on mount instead of on scroll (used for the first viewport). */
  immediate?: boolean;
  className?: string;
};

/**
 * Single enter recipe (opacity + translateY + blur) driven by `.reveal` in
 * globals.css. On-scroll variants use an IntersectionObserver and fire once;
 * `immediate` variants reveal on mount for the orchestrated first paint.
 * Reduced-motion users skip straight to the resting state via CSS.
 */
export function Reveal({
  children,
  as,
  delay = 0,
  immediate = false,
  className,
}: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (immediate) {
      const id = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(id);
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <Tag
      ref={ref}
      data-shown={shown}
      className={`reveal${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
