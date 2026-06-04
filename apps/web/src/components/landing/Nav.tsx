"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/site/Button";
import { ModeToggle } from "@/components/site/ModeToggle";

const links = [
  { label: "How it works", href: "#how" },
  { label: "What you get", href: "#features" },
  { label: "The idea", href: "#idea" },
];

// Past this many px the glass chrome fades in. Small enough to react to the
// first flick of scroll, large enough to not flicker on sub-pixel jitter.
const SCROLL_THRESHOLD = 12;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update(); // sync state if the page loads already scrolled (refresh / anchor)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        data-scrolled={scrolled}
        className="intro-down nav-shell mx-auto flex h-15 max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-5"
      >
        <a
          href="#top"
          className="intro-down rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
          style={{ animationDelay: "0.12s" }}
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link, i) => (
            <li
              key={link.href}
              className="intro-down"
              style={{ animationDelay: `${0.18 + i * 0.06}s` }}
            >
              <a
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[0.9rem] text-dim transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div
          className="intro-down flex items-center gap-1.5"
          style={{ animationDelay: "0.36s" }}
        >
          <ModeToggle />
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button href="/signup">Get started</Button>
        </div>
      </nav>
    </header>
  );
}
